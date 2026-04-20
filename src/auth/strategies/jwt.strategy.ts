import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';

/**
 * JWT access token strategy using Keycloak's JWKS endpoint for RS256 verification.
 * Automatically rotates keys without API restarts via JWKS caching.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly configService: ConfigService) {
    const jwksUri = configService.get<string>('KEYCLOAK_JWKS_URI');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: jwksUri!,
      }),
      issuer: `${configService.get('KEYCLOAK_BASE_URL')}/realms/${configService.get('KEYCLOAK_REALM')}`,
    });
  }

  /**
   * Validate the decoded JWT payload.
   * Returns the user object that will be attached to request.user.
   */
  async validate(payload: Record<string, any>) {
    if (!payload.sub) {
      this.logger.warn('JWT payload missing sub claim');
      throw new UnauthorizedException('Invalid token: missing subject');
    }

    return {
      keycloakId: payload.sub,
      email: payload.email || payload.preferred_username,
      tenantId: payload.tenant_id,
      roles: payload.roles || payload.realm_access?.roles || [],
      permissions: payload.permissions || [],
      sessionId: payload.session_state,
    };
  }
}
