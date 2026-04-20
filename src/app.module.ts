import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
<<<<<<< HEAD
import { DatabaseModule } from './database/database.module';
=======
import { DatabaseModule } from './database/prisma.module';
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
import { TenantContextMiddleware } from './auth/middleware/tenant-context.middleware';

@Module({
  imports: [
<<<<<<< HEAD
    // ── Configuration ────────────────────────────────────────
=======
    // ── Configuration ───────────────────────────────────────
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      validationSchema: envValidationSchema,
      validationOptions: {
<<<<<<< HEAD
        abortEarly: true,
        allowUnknown: true,
      },
    }),

    // ── Rate Limiting (Redis-backed) ─────────────────────────
=======
        abortEarly: false,
        allowUnknown: true,
      },
      cache: true,
      expandVariables: true,
    }),

    // ── Rate Limiting ───────────────────────────────────────
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
<<<<<<< HEAD
            ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT', 60),
=======
            name: 'default',
            ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
          {
            name: 'auth',
            ttl: 60000, // 1 minute
            limit: 10,  // 10 auth requests per minute
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
          },
        ],
      }),
    }),

<<<<<<< HEAD
    // ── Feature Modules ──────────────────────────────────────
    DatabaseModule,
    HealthModule,
    AuthModule,
  ],
  providers: [
    // Apply rate limiting globally
=======
    // ── Database ────────────────────────────────────────────
    DatabaseModule,

    // ── Health Checks ───────────────────────────────────────
    HealthModule,

    // ── Auth & Multi-Tenancy ────────────────────────────────
    AuthModule,
  ],
  providers: [
    // Global rate limiting guard
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
<<<<<<< HEAD
    // Apply tenant context middleware to all routes except health checks
    consumer
      .apply(TenantContextMiddleware)
      .exclude('health/(.*)')
=======
    consumer
      .apply(TenantContextMiddleware)
      .exclude(
        'health/(.*)',
        'api-docs(.*)',
      )
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
      .forRoutes('*');
  }
}
