<<<<<<< HEAD
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';

/**
 * Refresh token strategy — validates refresh tokens for the /auth/refresh endpoint.
 * Uses the same JWKS endpoint but a different strategy name.
 */
@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  private readonly logger = new Logger(RefreshTokenStrategy.name);

  constructor(private readonly configService: ConfigService) {
    const jwksUri = configService.get<string>('KEYCLOAK_JWKS_URI');

    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: jwksUri!,
      }),
=======
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma.service';

/**
 * Refresh token strategy for token rotation.
 * Validates refresh tokens stored in the database and checks revocation status.
 */
@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  private readonly logger = new Logger(RefreshTokenStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_REFRESH_SECRET',
        'amdox-refresh-secret-change-in-production',
      ),
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
      passReqToCallback: true,
    });
  }

<<<<<<< HEAD
  async validate(req: any, payload: Record<string, any>) {
=======
  /**
   * Validate refresh token — check if it exists, is not revoked, and not expired.
   */
  async validate(
    req: any,
    payload: { sub: string; tenant_id: string; type: string },
  ) {
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
    const refreshToken = req.body?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

<<<<<<< HEAD
    if (!payload.sub) {
      this.logger.warn('Refresh token payload missing sub claim');
      throw new UnauthorizedException('Invalid token: missing subject');
    }

    return {
      keycloakId: payload.sub,
      email: payload.email || payload.preferred_username,
      tenantId: payload.tenant_id,
      roles: payload.roles || payload.realm_access?.roles || [],
      refreshToken,
=======
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Check token in database
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        userId: payload.sub,
        isRevoked: false,
      },
    });

    if (!storedToken) {
      this.logger.warn(
        `Refresh token not found or revoked for user ${payload.sub}`,
      );
      throw new UnauthorizedException('Refresh token is invalid or revoked');
    }

    // Check expiration
    if (storedToken.expiresAt < new Date()) {
      this.logger.warn(`Expired refresh token used by user ${payload.sub}`);
      throw new UnauthorizedException('Refresh token has expired');
    }

    return {
      sub: payload.sub,
      tenant_id: payload.tenant_id,
      refreshToken,
      tokenId: storedToken.id,
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
    };
  }
}
