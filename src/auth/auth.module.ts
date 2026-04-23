import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { RolesGuard, TenantIsolationGuard, AbacGuard, JwtAuthGuard } from './guards';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_REFRESH_SECRET',
          'amdox-refresh-secret-change-in-production',
        ),
        signOptions: {
          issuer: configService.get<string>('JWT_ISSUER'),
          audience: configService.get<string>('JWT_AUDIENCE', 'amdox-api'),
          algorithm: 'HS256',
        },
      }),
    }),
    DatabaseModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    RefreshTokenStrategy,
    RolesGuard,
    TenantIsolationGuard,
    AbacGuard,
    JwtAuthGuard,
  ],
  exports: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    TenantIsolationGuard,
    AbacGuard,
    JwtAuthGuard,
  ],
})
export class AuthModule {}
