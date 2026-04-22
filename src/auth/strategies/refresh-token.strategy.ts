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
   * Validate refresh token — check if it exists, is not revoked, and not expired.
   */
  async validate(req: any, payload: { sub: string; tenant_id: string; type: string }) {
    const refreshToken = req.body?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

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
      this.logger.warn(`Refresh token not found or revoked for user ${payload.sub}`);
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
    };
  }
}
