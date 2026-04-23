import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { FinanceModule } from './finance/finance.module';
import { ApArModule } from './ap-ar/ap-ar.module';
import { HrModule } from './hr/hr.module';
import { ScmModule } from './scm/scm.module';
import { TenantContextMiddleware } from './auth/middleware/tenant-context.middleware';

@Module({
  imports: [
    // ── Configuration ───────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
      cache: true,
      expandVariables: true,
    }),

    // ── Rate Limiting ───────────────────────────────────────
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
          {
            name: 'auth',
            ttl: 60000, // 1 minute
            limit: 10, // 10 auth requests per minute
          },
        ],
      }),
    }),

    // ── Background Jobs (BullMQ) ───────────────────────────
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
        },
      }),
    }),

    // ── Feature Modules ──────────────────────────────────────
    DatabaseModule,
    HealthModule,
    AuthModule,
    FinanceModule,
    ApArModule,
    HrModule,
    ScmModule,
  ],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant context middleware to all routes except health checks and swagger docs
    consumer
      .apply(TenantContextMiddleware)
      .exclude(
        'health/(.*)',
        'api-docs(.*)',
      )
      .forRoutes('*');
  }
}
