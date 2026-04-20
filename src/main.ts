import { NestFactory } from '@nestjs/core';
<<<<<<< HEAD
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
=======
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');
  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:4200');

  // ── Global Prefix ───────────────────────────────────────────
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['health/live', 'health/ready', 'health/db', 'health/cache', 'health/es'],
  });

  // ── API Versioning ──────────────────────────────────────────
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ── Security ────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // ── Compression ─────────────────────────────────────────────
  app.use(compression());

  // ── Cookie Parser ───────────────────────────────────────────
  app.use(cookieParser());

  // ── CORS ────────────────────────────────────────────────────
  app.enableCors({
    origin: corsOrigins.split(',').map((o: string) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Request-ID'],
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
    exposedHeaders: ['X-Request-ID', 'X-Total-Count'],
    credentials: true,
    maxAge: 3600,
  });

<<<<<<< HEAD
  // ── Global Pipes ──────────────────────────────────────────
=======
  // ── Global Pipes ────────────────────────────────────────────
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
<<<<<<< HEAD
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
=======
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // ── Global Filters ──────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter(configService));

  // ── Global Interceptors ─────────────────────────────────────
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ── Swagger / OpenAPI ───────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AMDOX ERP Platform API')
    .setDescription(
      'Multi-tenant Enterprise Resource Planning API. ' +
      'Covers Finance, HR, Inventory, Procurement, and more.',
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
<<<<<<< HEAD
        description: 'Enter your Keycloak JWT access token',
=======
        description: 'Enter your JWT access token',
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
        in: 'header',
      },
      'access-token',
    )
<<<<<<< HEAD
    .addServer('http://localhost:3000', 'Local Development')
    .addTag('Health', 'Liveness, readiness, and dependency health checks')
    .addTag('Auth', 'Authentication, token management, and session control')
=======
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Tenant-ID',
        in: 'header',
        description: 'Tenant identifier (auto-injected from JWT in production)',
      },
      'tenant-id',
    )
    .addServer(`http://localhost:${port}`, 'Local Development')
    .addTag('Auth', 'Authentication & authorization endpoints')
    .addTag('Health', 'System health check endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Accounts', 'Chart of Accounts & GL management')
    .addTag('Transactions', 'Financial transaction endpoints')
    .addTag('Journal Entries', 'Journal entry management')
    .addTag('Employees', 'HR & employee management')
    .addTag('Purchase Orders', 'Procurement management')
    .addTag('Inventory', 'Inventory & stock management')
    .addTag('Notifications', 'Notification management')
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
<<<<<<< HEAD
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
=======
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'AMDOX ERP API Docs',
  });

  // ── Graceful Shutdown ───────────────────────────────────────
  app.enableShutdownHooks();

  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received — starting graceful shutdown...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received — starting graceful shutdown...');
    await app.close();
    process.exit(0);
  });

  // ── Start Server ────────────────────────────────────────────
  await app.listen(port);
  logger.log(`🚀 AMDOX ERP API running on: http://localhost:${port}`);
  logger.log(`📚 Swagger docs available at: http://localhost:${port}/api-docs`);
  logger.log(`❤️  Health check at: http://localhost:${port}/health/live`);
  logger.log(`🔧 Environment: ${configService.get<string>('NODE_ENV', 'development')}`);
}

bootstrap();
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
