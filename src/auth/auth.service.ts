import {
  Injectable,
  UnauthorizedException,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import { UserRepository } from '../database/repositories/user.repository';
import { LoginDto, AuthResponseDto } from './dto';

import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

/**
 * AuthService handles authentication logic:
 * - Keycloak token exchange for credential validation
 * - Local user provisioning and permission mapping
 * - JWT access + refresh token generation and rotation
 * - Token blacklist management via Redis
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly redis: Redis;
  private readonly accessTokenExpiration: number;
  private readonly refreshTokenExpiration: number;
  private readonly keycloakBaseUrl: string;
  private readonly keycloakRealm: string;
  private readonly keycloakClientId: string;
  private readonly keycloakClientSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly userRepository: UserRepository,
  ) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD') || undefined,
      db: this.configService.get('REDIS_DB', 0),
      keyPrefix: 'amdox:auth:',
    });

    this.accessTokenExpiration = this.configService.get<number>('JWT_ACCESS_EXPIRATION', 3600);
    this.refreshTokenExpiration = this.configService.get<number>('JWT_REFRESH_EXPIRATION', 604800);
    this.keycloakBaseUrl = this.configService.get<string>('KEYCLOAK_BASE_URL')!;
    this.keycloakRealm = this.configService.get<string>('KEYCLOAK_REALM', 'amdox');
    this.keycloakClientId = this.configService.get<string>('KEYCLOAK_CLIENT_ID')!;
    this.keycloakClientSecret = this.configService.get<string>('KEYCLOAK_CLIENT_SECRET')!;
  }

  /**
   * Authenticate user via Keycloak and return local tokens.
   */
  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    this.logger.log(`Login attempt for: ${loginDto.email}`);

    try {
      // ── Step 1: Validate Credentials with Keycloak ────────────────
      const keycloakTokens = await this.exchangeCredentials(
        loginDto.email,
        loginDto.password,
      );

      const keycloakPayload = this.jwtService.decode(keycloakTokens.access_token) as any;

      if (!keycloakPayload) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // ── Step 2: Sync / Provision User ──────────────────────────────
      let user = await this.userRepository.findByKeycloakId(keycloakPayload.sub);

      if (!user) {
        const tenantId = keycloakPayload.tenant_id || keycloakPayload.target_tenant_id;
        if (!tenantId) {
          throw new BadRequestException('User does not have a tenant assignment in Keycloak');
        }

        user = await this.prisma.user.create({
          data: {
            email: keycloakPayload.email,
            firstName: keycloakPayload.given_name,
            lastName: keycloakPayload.family_name,
            keycloakId: keycloakPayload.sub,
            tenantId,
            emailVerifiedAt: keycloakPayload.email_verified ? new Date() : null,
          },
          include: {
            roles: { include: { role: true } },
            tenant: true,
          },
        }) as any;
      }

      // ── Step 3: Update Metadata & Permissions ─────────────────────
      await this.userRepository.updateLastLogin(user!.id);
      const permissions = await this.userRepository.getUserPermissions(user!.id, user!.tenantId);
      const roles = (user as any).roles?.map((ur: any) => ur.role.name) || keycloakPayload.roles || [];

      // ── Step 4: Issue Local JWTs ──────────────────────────────────
      const accessToken = await this.generateAccessToken({
        sub: user!.id,
        email: user!.email,
        tenant_id: user!.tenantId,
        roles,
        permissions,
      });

      const refreshToken = await this.generateRefreshToken(
        user!.id,
        user!.tenantId,
        ipAddress,
        userAgent,
      );

      this.logger.log(`Login successful for: ${loginDto.email}`);

      return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: this.accessTokenExpiration,
        user: {
          id: user!.id,
          email: user!.email,
          firstName: user!.firstName || undefined,
          lastName: user!.lastName || undefined,
          tenantId: user!.tenantId,
          roles,
          permissions,
        },
      };
    } catch (error: any) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Login failed for ${loginDto.email}: ${errorMessage}`);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  /**
   * Refresh access token using a valid refresh token.
   * Implements token rotation and blacklist checks.
   */
  async refresh(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const isBlacklisted = await this.isTokenBlacklisted(refreshToken);
    if (isBlacklisted) {
      this.logger.warn('Attempted use of blacklisted refresh token — possible replay attack');
      throw new UnauthorizedException('Token has been revoked');
    }

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        isRevoked: false,
      },
      include: {
        user: {
          include: {
            roles: { include: { role: true } },
          },
        },
      },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = storedToken.user;
    const permissions = await this.userRepository.getUserPermissions(user.id, user.tenantId);
    const roles = (user as any).roles.map((ur: any) => ur.role.name);

    // ── Rotate Token ──────────────────────────────────────────
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true, revokedAt: new Date() },
    });
    await this.blacklistToken(refreshToken, this.refreshTokenExpiration);

    // ── Generate New Tokens ──────────────────────────────────
    const newAccessToken = await this.generateAccessToken({
      sub: user.id,
      email: user.email,
      tenant_id: user.tenantId,
      roles,
      permissions,
    });

    const newRefreshToken = await this.generateRefreshToken(
      user.id,
      user.tenantId,
      ipAddress,
      userAgent,
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTokenExpiration,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        tenantId: user.tenantId,
        roles,
        permissions,
      },
    };
  }

  /**
   * Logout — revoke tokens at Keycloak and locally.
   */
  async logout(userId: string, accessToken?: string, refreshToken?: string): Promise<void> {
    try {
      if (refreshToken) {
        // Revoke at Keycloak (best effort)
        this.revokeKeycloakToken(refreshToken).catch(() => {});

        // Revoke locally
        await this.prisma.refreshToken.updateMany({
          where: { userId, token: refreshToken, isRevoked: false },
          data: { isRevoked: true, revokedAt: new Date() },
        });

        await this.blacklistToken(refreshToken, this.refreshTokenExpiration);
      } else {
        // Revoke all tokens for user
        await this.prisma.refreshToken.updateMany({
          where: { userId, isRevoked: false },
          data: { isRevoked: true, revokedAt: new Date() },
        });
      }

      if (accessToken) {
        await this.blacklistToken(accessToken, this.accessTokenExpiration);
      }

      this.logger.log(`User ${userId} logged out`);
    } catch (error) {
      this.logger.error(`Logout error for user ${userId}: ${(error as Error).message}`);
    }
  }

  /**
   * Exchange credentials with Keycloak via Direct Access Grant.
   */
  private async exchangeCredentials(email: string, password: string) {
    const tokenUrl = `${this.keycloakBaseUrl}/realms/${this.keycloakRealm}/protocol/openid-connect/token`;

    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: this.keycloakClientId,
      client_secret: this.keycloakClientSecret,
      username: email,
      password: password,
      scope: 'openid profile email',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.warn(`Keycloak auth failed: ${response.status} — ${errorBody}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    return response.json();
  }

  /**
   * Revoke token at Keycloak.
   */
  private async revokeKeycloakToken(refreshToken: string) {
    const logoutUrl = `${this.keycloakBaseUrl}/realms/${this.keycloakRealm}/protocol/openid-connect/logout`;
    const params = new URLSearchParams({
      client_id: this.keycloakClientId,
      client_secret: this.keycloakClientSecret,
      refresh_token: refreshToken,
    });

    await fetch(logoutUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
  }

  /**
   * Token Blacklisting (Redis)
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const hash = this.hashToken(token);
    const result = await this.redis.get(`blacklist:${hash}`);
    return result !== null;
  }

  private async blacklistToken(token: string, ttlSeconds: number): Promise<void> {
    const hash = this.hashToken(token);
    await this.redis.set(`blacklist:${hash}`, '1', 'EX', ttlSeconds);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
  }

  /**
   * JWT Generation
   */
  private async generateAccessToken(payload: any): Promise<string> {
    return this.jwtService.signAsync(
      { ...payload, type: 'access' },
      { expiresIn: this.accessTokenExpiration },
    );
  }

  private async generateRefreshToken(
    userId: string,
    tenantId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const tokenValue = uuidv4();
    const expiresAt = new Date(Date.now() + this.refreshTokenExpiration * 1000);

    const token = this.jwtService.sign(
      { sub: userId, tenant_id: tenantId, type: 'refresh', jti: tokenValue },
      { expiresIn: this.refreshTokenExpiration },
    );

    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
        ipAddress,
        deviceInfo: userAgent?.substring(0, 500),
      },
    });

    this.cleanupExpiredTokens(userId).catch(() => {});
    return token;
  }

  private async cleanupExpiredTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true, revokedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        ],
      },
    });
  }
}
