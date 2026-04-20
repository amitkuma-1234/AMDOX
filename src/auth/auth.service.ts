import {
  Injectable,
  UnauthorizedException,
  Logger,
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
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
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
    }
  }

  /**
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
    }

    return response.json();
  }

  /**
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
  }
}
