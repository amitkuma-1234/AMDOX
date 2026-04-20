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
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: Record<string, any>) {
    const refreshToken = req.body?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

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
    };
  }
}
