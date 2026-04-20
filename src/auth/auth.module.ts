import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { RolesGuard } from './guards/roles.guard';
import { TenantIsolationGuard } from './guards/tenant-isolation.guard';
import { AbacGuard } from './guards/abac.guard';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
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
  ],
  exports: [AuthService, RolesGuard, TenantIsolationGuard, AbacGuard],
})
export class AuthModule {}
