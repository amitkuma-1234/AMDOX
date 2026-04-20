import {
  Injectable,
  UnauthorizedException,
  Logger,
<<<<<<< HEAD
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';

/**
 * Auth service handling Keycloak token exchange, refresh token rotation,
 * token blacklisting (Redis), and user lookup/sync.
=======
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { UserRepository } from '../repositories/user.repository';
import { LoginDto, AuthResponseDto } from './dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { v4 as uuidv4 } from 'uuid';

/**
 * AuthService handles authentication logic:
 * - Keycloak token exchange for login
 * - JWT access + refresh token generation
 * - Refresh token rotation with revocation
 * - Token blacklist management via Redis
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
<<<<<<< HEAD
  private readonly redis: Redis;
=======
  private readonly accessTokenExpiration: number;
  private readonly refreshTokenExpiration: number;
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
  private readonly keycloakBaseUrl: string;
  private readonly keycloakRealm: string;
  private readonly keycloakClientId: string;
  private readonly keycloakClientSecret: string;
<<<<<<< HEAD
  private readonly accessTokenExpiration: number;
  private readonly refreshTokenExpiration: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD') || undefined,
      db: this.configService.get('REDIS_DB', 0),
      keyPrefix: 'amdox:auth:',
    });

    this.keycloakBaseUrl = this.configService.get('KEYCLOAK_BASE_URL')!;
    this.keycloakRealm = this.configService.get('KEYCLOAK_REALM')!;
    this.keycloakClientId = this.configService.get('KEYCLOAK_CLIENT_ID')!;
    this.keycloakClientSecret = this.configService.get('KEYCLOAK_CLIENT_SECRET')!;
    this.accessTokenExpiration = this.configService.get('JWT_ACCESS_EXPIRATION', 3600);
    this.refreshTokenExpiration = this.configService.get('JWT_REFRESH_EXPIRATION', 604800);
  }

  /**
   * Authenticate user via Keycloak's Direct Access Grants (Resource Owner Password).
   * Returns access token + refresh token pair.
   */
  async login(email: string, password: string) {
    try {
      const tokenUrl = `${this.keycloakBaseUrl}/realms/${this.keycloakRealm}/protocol/openid-connect/token`;

      const body = new URLSearchParams({
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
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.logger.warn(`Keycloak login failed for ${email}: ${JSON.stringify(errorData)}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      const tokenData = await response.json();

      // Sync user to local database
      await this.syncUserFromKeycloak(tokenData.access_token);

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        refreshExpiresIn: tokenData.refresh_expires_in,
        tokenType: tokenData.token_type,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error(`Login error: ${(error as Error).message}`);
      throw new InternalServerErrorException('Authentication service unavailable');
    }
  }

  /**
   * Refresh access token using Keycloak's refresh token grant.
   * Implements token rotation: old refresh token is blacklisted.
   */
  async refreshToken(refreshToken: string) {
    // Check if refresh token is blacklisted (replay attack protection)
    const isBlacklisted = await this.isTokenBlacklisted(refreshToken);
    if (isBlacklisted) {
      this.logger.warn('Attempted use of blacklisted refresh token — possible replay attack');
      throw new UnauthorizedException('Token has been revoked');
    }

    try {
      const tokenUrl = `${this.keycloakBaseUrl}/realms/${this.keycloakRealm}/protocol/openid-connect/token`;

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.keycloakClientId,
        client_secret: this.keycloakClientSecret,
        refresh_token: refreshToken,
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const tokenData = await response.json();

      // Blacklist the old refresh token (rotation)
      await this.blacklistToken(refreshToken, this.refreshTokenExpiration);

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        refreshExpiresIn: tokenData.refresh_expires_in,
        tokenType: tokenData.token_type,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error(`Refresh token error: ${(error as Error).message}`);
      throw new InternalServerErrorException('Token refresh failed');
=======

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly userRepository: UserRepository,
  ) {
    this.accessTokenExpiration = configService.get<number>(
      'JWT_ACCESS_TOKEN_EXPIRATION',
      3600,
    );
    this.refreshTokenExpiration = configService.get<number>(
      'JWT_REFRESH_TOKEN_EXPIRATION',
      604800,
    );
    this.keycloakBaseUrl = configService.get<string>('KEYCLOAK_BASE_URL')!;
    this.keycloakRealm = configService.get<string>('KEYCLOAK_REALM', 'amdox');
    this.keycloakClientId = configService.get<string>('KEYCLOAK_CLIENT_ID')!;
    this.keycloakClientSecret = configService.get<string>(
      'KEYCLOAK_CLIENT_SECRET',
    )!;
  }

  /**
   * Authenticate user via Keycloak and return tokens.
   */
  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthResponseDto> {
    this.logger.log(`Login attempt for: ${loginDto.email}`);

    try {
      // Exchange credentials with Keycloak
      const keycloakTokens = await this.exchangeCredentials(
        loginDto.email,
        loginDto.password,
      );

      // Decode Keycloak access token to get user info
      const keycloakPayload = this.jwtService.decode(
        keycloakTokens.access_token,
      ) as any;

      if (!keycloakPayload) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Find or create user in local database
      let user = await this.userRepository.findByKeycloakId(
        keycloakPayload.sub,
      );

      if (!user) {
        // Auto-provision user from Keycloak claims
        const tenantId = keycloakPayload.tenant_id;
        if (!tenantId) {
          throw new BadRequestException(
            'User does not have a tenant assignment in Keycloak',
          );
        }

        user = await this.prisma.user.create({
          data: {
            email: keycloakPayload.email,
            firstName: keycloakPayload.given_name,
            lastName: keycloakPayload.family_name,
            keycloakId: keycloakPayload.sub,
            tenantId,
            emailVerifiedAt: keycloakPayload.email_verified
              ? new Date()
              : null,
          },
          include: {
            userRoles: { include: { role: true } },
            tenant: true,
          },
        }) as any;
      }

      // Update last login
      await this.userRepository.updateLastLogin(user!.id);

      // Get user permissions
      const permissions = await this.userRepository.getPermissions(user!.id);
      const roles = user!.userRoles?.map((ur: any) => ur.role.name) || keycloakPayload.roles || [];

      // Generate our own tokens
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
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Login failed for ${loginDto.email}: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid credentials');
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
    }
  }

  /**
<<<<<<< HEAD
   * Logout — revoke tokens at Keycloak and blacklist locally.
   */
  async logout(accessToken: string, refreshToken: string) {
    try {
      // Revoke at Keycloak
      const logoutUrl = `${this.keycloakBaseUrl}/realms/${this.keycloakRealm}/protocol/openid-connect/logout`;

      const body = new URLSearchParams({
        client_id: this.keycloakClientId,
        client_secret: this.keycloakClientSecret,
        refresh_token: refreshToken,
      });

      await fetch(logoutUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      // Blacklist tokens locally in Redis
      await this.blacklistToken(accessToken, this.accessTokenExpiration);
      await this.blacklistToken(refreshToken, this.refreshTokenExpiration);

      return { message: 'Logged out successfully' };
    } catch (error) {
      this.logger.error(`Logout error: ${(error as Error).message}`);
      // Don't throw — logout should be best-effort
      return { message: 'Logged out (partial — Keycloak revocation may have failed)' };
    }
  }

  /**
   * Fetch user info from Keycloak userinfo endpoint.
   */
  async getUserInfoFromKeycloak(accessToken: string) {
    const userInfoUrl = `${this.keycloakBaseUrl}/realms/${this.keycloakRealm}/protocol/openid-connect/userinfo`;

    const response = await fetch(userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to fetch user info from Keycloak');
=======
   * Refresh access token using a valid refresh token.
   * Implements token rotation — old refresh token is revoked.
   */
  async refresh(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    // Find and validate the refresh token
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        isRevoked: false,
      },
      include: {
        user: {
          include: {
            userRoles: { include: { role: true } },
          },
        },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = storedToken.user;
    const permissions = await this.userRepository.getPermissions(user.id);
    const roles = user.userRoles.map((ur) => ur.role.name);

    // Revoke old refresh token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    // Generate new tokens
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
   * Logout — revoke all refresh tokens for the user or a specific token.
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Revoke specific token
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          token: refreshToken,
          isRevoked: false,
        },
        data: { isRevoked: true, revokedAt: new Date() },
      });
    } else {
      // Revoke all tokens for user
      await this.prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      });
    }

    this.logger.log(`User ${userId} logged out`);
  }

  /**
   * Exchange credentials with Keycloak via Direct Access Grant.
   */
  private async exchangeCredentials(
    email: string,
    password: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
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
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
    }

    return response.json();
  }

  /**
<<<<<<< HEAD
   * Sync Keycloak user to local database (upsert).
   * Called after successful login to ensure local user record exists.
   */
  private async syncUserFromKeycloak(accessToken: string) {
    try {
      const userInfo = await this.getUserInfoFromKeycloak(accessToken);

      if (!userInfo.sub || !userInfo.tenant_id) {
        this.logger.warn('Keycloak user info missing sub or tenant_id');
        return;
      }

      await this.prisma.user.upsert({
        where: { keycloakId: userInfo.sub },
        update: {
          email: userInfo.email,
          firstName: userInfo.given_name,
          lastName: userInfo.family_name,
          lastLoginAt: new Date(),
        },
        create: {
          keycloakId: userInfo.sub,
          email: userInfo.email,
          firstName: userInfo.given_name,
          lastName: userInfo.family_name,
          tenantId: userInfo.tenant_id,
          lastLoginAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`User sync failed: ${(error as Error).message}`);
      // Non-fatal — user can still authenticate
    }
  }

  /**
   * Check if a token is blacklisted in Redis.
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const hash = this.hashToken(token);
    const result = await this.redis.get(`blacklist:${hash}`);
    return result !== null;
  }

  /**
   * Add a token to the blacklist with TTL matching token expiration.
   */
  private async blacklistToken(token: string, ttlSeconds: number): Promise<void> {
    const hash = this.hashToken(token);
    await this.redis.set(`blacklist:${hash}`, '1', 'EX', ttlSeconds);
  }

  /**
   * Hash token for storage (don't store raw tokens in Redis).
   */
  private hashToken(token: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
=======
   * Generate JWT access token.
   */
  private async generateAccessToken(payload: {
    sub: string;
    email: string;
    tenant_id: string;
    roles: string[];
    permissions: string[];
  }): Promise<string> {
    return this.jwtService.signAsync(
      {
        ...payload,
        type: 'access',
      },
      {
        expiresIn: this.accessTokenExpiration,
      },
    );
  }

  /**
   * Generate refresh token and store in database.
   */
  private async generateRefreshToken(
    userId: string,
    tenantId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const tokenValue = uuidv4();
    const expiresAt = new Date(
      Date.now() + this.refreshTokenExpiration * 1000,
    );

    const token = this.jwtService.sign(
      {
        sub: userId,
        tenant_id: tenantId,
        type: 'refresh',
        jti: tokenValue,
      },
      {
        expiresIn: this.refreshTokenExpiration,
      },
    );

    // Store in database
    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
        ipAddress,
        deviceInfo: userAgent?.substring(0, 500),
      },
    });

    // Clean up expired tokens (background)
    this.cleanupExpiredTokens(userId).catch((err) =>
      this.logger.warn(`Token cleanup failed: ${err.message}`),
    );

    return token;
  }

  /**
   * Clean up expired refresh tokens for a user.
   */
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
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
  }
}
