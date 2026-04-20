import {
  Injectable,
  UnauthorizedException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';

/**
 * Auth service handling Keycloak token exchange, refresh token rotation,
 * token blacklisting (Redis), and user lookup/sync.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly redis: Redis;
  private readonly keycloakBaseUrl: string;
  private readonly keycloakRealm: string;
  private readonly keycloakClientId: string;
  private readonly keycloakClientSecret: string;
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
    }
  }

  /**
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
    }

    return response.json();
  }

  /**
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
  }
}
