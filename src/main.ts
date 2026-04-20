import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // ── Security Headers ──────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Allow Swagger UI scripts
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ── CORS ──────────────────────────────────────────────────
  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Tenant-ID',
      'Accept',
    ],
    exposedHeaders: ['X-Request-ID', 'X-Total-Count'],
    credentials: true,
    maxAge: 3600,
  });

  // ── Global Pipes ──────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: configService.get('NODE_ENV') === 'production',
    }),
  );

  // ── Global Filters & Interceptors ─────────────────────────
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // ── API Versioning ────────────────────────────────────────
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  // ── Swagger Documentation ─────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AMDOX ERP API')
    .setDescription(
      'Multi-tenant enterprise resource planning platform API.\n\n' +
        '## Authentication\n' +
        'All endpoints (except health checks) require a valid JWT Bearer token.\n' +
        'Obtain tokens via `POST /auth/login` using Keycloak credentials.\n\n' +
        '## Multi-Tenancy\n' +
        'Tenant context is extracted from the JWT `tenant_id` claim.\n' +
        'All data is isolated per tenant via row-level security.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your Keycloak JWT access token',
        in: 'header',
      },
      'access-token',
    )
    .addServer('http://localhost:3000', 'Local Development')
    .addTag('Health', 'Liveness, readiness, and dependency health checks')
    .addTag('Auth', 'Authentication, token management, and session control')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
  });

  // ── Graceful Shutdown ─────────────────────────────────────
  app.enableShutdownHooks();

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  logger.log(`─────────────────────────────────────────────────`);
  logger.log(`🚀 AMDOX API is running on: http://localhost:${port}`);
  logger.log(`📖 Swagger docs:            http://localhost:${port}/api-docs`);
  logger.log(`🏥 Health check:            http://localhost:${port}/health/live`);
  logger.log(`🔧 Environment:             ${configService.get('NODE_ENV')}`);
  logger.log(`─────────────────────────────────────────────────`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start AMDOX API', error);
  process.exit(1);
});
