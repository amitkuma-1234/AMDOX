import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

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
        imgSrc: ["'self'", 'data:', 'validator.swagger.io', 'https:'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ── Compression ─────────────────────────────────────────────
  app.use(compression());

  // ── Cookie Parser ───────────────────────────────────────────
  app.use(cookieParser());

  // ── CORS ────────────────────────────────────────────────────
  app.enableCors({
    origin: corsOrigins.split(',').map((o: string) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Request-ID', 'Accept'],
    exposedHeaders: ['X-Request-ID', 'X-Total-Count'],
    credentials: true,
    maxAge: 3600,
  });

  // ── Global Pipes ────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: configService.get('NODE_ENV') === 'production',
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // ── Global Filters ──────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter(configService));

  // ── Global Interceptors ─────────────────────────────────────
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // ── Swagger / OpenAPI ───────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AMDOX ERP Platform API')
    .setDescription(
      'Multi-tenant Enterprise Resource Planning API.\n\n' +
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
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
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
  logger.log(`─────────────────────────────────────────────────`);
  logger.log(`🚀 AMDOX ERP API is running on: http://localhost:${port}`);
  logger.log(`📚 Swagger docs available at: http://localhost:${port}/api-docs`);
  logger.log(`❤️  Health check at: http://localhost:${port}/health/live`);
  logger.log(`🔧 Environment: ${configService.get<string>('NODE_ENV', 'development')}`);
  logger.log(`─────────────────────────────────────────────────`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start AMDOX API', error);
  process.exit(1);
});
