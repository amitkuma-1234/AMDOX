import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma.service';

/**
 * RefreshTokenStrategy validates local refresh tokens for token rotation.
 * It checks the database to ensure the token exists, is not revoked, and is not expired.
 */
@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
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
      passReqToCallback: true,
    });
  }

  /**
   * Validate refresh token — check if it exists in DB, is not revoked, and matches user.
   */
  async validate(
    req: any,
    payload: { sub: string; tenant_id: string; type: string; jti: string },
  ) {
    const refreshToken = req.body?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type for this endpoint');
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
      this.logger.warn(`Refresh token not found or revoked for user ${payload.sub}`);
      throw new UnauthorizedException('Refresh token is invalid or revoked');
    }

    // Check expiration (Prisma and JWT both have it, but database is the source of truth for revocation)
    if (storedToken.expiresAt < new Date()) {
      this.logger.warn(`Expired refresh token used by user ${payload.sub}`);
      throw new UnauthorizedException('Refresh token has expired');
    }

    return {
      userId: payload.sub,
      tenantId: payload.tenant_id,
      refreshToken,
      tokenId: storedToken.id,
    };
  }
}
