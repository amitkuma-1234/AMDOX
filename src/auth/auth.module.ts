import { Module } from '@nestjs/common';
<<<<<<< HEAD
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
=======
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { RolesGuard } from './guards/roles.guard';
import { TenantIsolationGuard } from './guards/tenant-isolation.guard';
import { AbacGuard } from './guards/abac.guard';
<<<<<<< HEAD
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    DatabaseModule,
=======
import { UserRepository } from '../repositories/user.repository';

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
          algorithm: 'HS256', // Used for app-generated tokens (refresh)
        },
      }),
    }),
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    RefreshTokenStrategy,
    RolesGuard,
    TenantIsolationGuard,
    AbacGuard,
<<<<<<< HEAD
  ],
  exports: [AuthService, RolesGuard, TenantIsolationGuard, AbacGuard],
=======
    UserRepository,
  ],
  exports: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    TenantIsolationGuard,
    AbacGuard,
    UserRepository,
  ],
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
})
export class AuthModule {}
