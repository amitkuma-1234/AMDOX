import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';

/**
 * JWT Passport strategy for access token validation.
 * Uses JWKS endpoint from Keycloak to dynamically fetch public keys.
 * Supports RS256 signature verification and claim validation.
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
    const jwksUri = configService.get<string>('KEYCLOAK_JWKS_URI')!;
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
  async validate(payload: JwtPayload): Promise<any> {
    this.logger.debug(
      `JWT validated for user: ${payload.sub} (tenant: ${payload.tenant_id})`,
    );

    // Ensure required claims are present
    if (!payload.sub) {
      this.logger.warn('JWT payload missing sub claim');
      throw new UnauthorizedException('Invalid token: missing subject');
    }

    if (!payload.tenant_id) {
      this.logger.warn(`JWT for user ${payload.sub} missing tenant_id claim`);
    }

    // Return a unified user object for downstream use
    return {
      userId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
      username: payload.preferred_username,
      firstName: payload.given_name,
      lastName: payload.family_name,
      tenantId: payload.tenant_id,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      issuedAt: payload.iat,
      expiresAt: payload.exp,
    };
  }
}
