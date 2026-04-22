import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

/**
 * JWT Passport strategy for access token validation.
 * Uses JWKS endpoint from Keycloak to dynamically fetch public keys.
 *
 * Validates:
 * - Token signature (RS256 via JWKS)
 * - Token expiration
 * - Issuer (Keycloak realm URL)
 * - Audience (amdox-api)
 */
export interface JwtPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  preferred_username: string;
  given_name?: string;
  family_name?: string;
  tenant_id: string;
  tenant_name?: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string | string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly configService: ConfigService) {
    const jwksUri = configService.get<string>('JWKS_URI')!;
    const issuer = configService.get<string>('JWT_ISSUER')!;
    const audience = configService.get<string>('JWT_AUDIENCE', 'amdox-api');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      issuer,
      audience,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri,
        handleSigningKeyError: (err: Error) => {
          new Logger('JwtStrategy').error(`JWKS key error: ${err.message}`);
        },
      }),
    });

    this.logger.log(`JWT Strategy initialized — JWKS: ${jwksUri}, Issuer: ${issuer}`);
  }

  /**
   * Validate callback invoked after JWT signature verification.
   * Returns the user payload that gets attached to request.user.
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    this.logger.debug(`JWT validated for user: ${payload.sub} (tenant: ${payload.tenant_id})`);

    // Ensure required claims are present
    if (!payload.sub) {
      throw new Error('JWT missing sub claim');
    }

    if (!payload.tenant_id) {
      this.logger.warn(`JWT for user ${payload.sub} missing tenant_id claim`);
    }

    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified,
      preferred_username: payload.preferred_username,
      given_name: payload.given_name,
      family_name: payload.family_name,
      tenant_id: payload.tenant_id,
      tenant_name: payload.tenant_name,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      iat: payload.iat,
      exp: payload.exp,
      iss: payload.iss,
      aud: payload.aud,
    };
  }
}
