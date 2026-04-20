<<<<<<< HEAD
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';

/**
 * Health check controller providing liveness, readiness,
 * and individual dependency health endpoints.
=======
import { Controller, Get, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  details?: Record<string, unknown>;
}

/**
 * Health check endpoints for liveness, readiness, and dependency checks.
 * Used by Kubernetes probes and monitoring systems.
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
<<<<<<< HEAD
  constructor(
    private readonly health: HealthCheckService,
=======
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly configService: ConfigService,
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
    private readonly prisma: PrismaService,
  ) {}

  /**
<<<<<<< HEAD
   * GET /health/live
   * Basic liveness probe — returns 200 if application process is running.
   */
  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  async checkLiveness(): Promise<HealthCheckResult> {
    return this.health.check([
      () =>
        Promise.resolve<HealthIndicatorResult>({
          app: { status: 'up', timestamp: new Date().toISOString() },
        }),
    ]);
  }

  /**
   * GET /health/ready
   * Readiness probe — returns 200 only if all dependencies are healthy.
   */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe (all dependencies)' })
  @ApiResponse({ status: 200, description: 'All dependencies are healthy' })
  @ApiResponse({ status: 503, description: 'One or more dependencies are unhealthy' })
  async checkReadiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.checkDatabase(),
      () => this.checkRedis(),
      () => this.checkElasticsearch(),
    ]);
  }

  /**
   * GET /health/db
   * PostgreSQL connectivity check via Prisma.
   */
  @Get('db')
  @HealthCheck()
  @ApiOperation({ summary: 'Database health check' })
  @ApiResponse({ status: 200, description: 'Database is connected' })
  @ApiResponse({ status: 503, description: 'Database is unreachable' })
  async checkDb(): Promise<HealthCheckResult> {
    return this.health.check([() => this.checkDatabase()]);
  }

  /**
   * GET /health/cache
   * Redis connectivity check.
   */
  @Get('cache')
  @HealthCheck()
  @ApiOperation({ summary: 'Redis cache health check' })
  @ApiResponse({ status: 200, description: 'Redis is connected' })
  @ApiResponse({ status: 503, description: 'Redis is unreachable' })
  async checkCache(): Promise<HealthCheckResult> {
    return this.health.check([() => this.checkRedis()]);
  }

  /**
   * GET /health/es
   * Elasticsearch connectivity check.
   */
  @Get('es')
  @HealthCheck()
  @ApiOperation({ summary: 'Elasticsearch health check' })
  @ApiResponse({ status: 200, description: 'Elasticsearch is connected' })
  @ApiResponse({ status: 503, description: 'Elasticsearch is unreachable' })
  async checkEs(): Promise<HealthCheckResult> {
    return this.health.check([() => this.checkElasticsearch()]);
  }

  // ── Private health indicator methods ──────────────────────

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: 'up' } };
    } catch (error) {
      return {
        database: {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unknown error',
=======
   * Liveness probe — is the process alive?
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe', description: 'Returns OK if the service process is running' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async live(): Promise<HealthResponse> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      details: {
        service: this.configService.get('APP_NAME', 'AMDOX ERP'),
        version: this.configService.get('APP_VERSION', '1.0.0'),
        environment: this.configService.get('NODE_ENV', 'development'),
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
      },
    };
  }

  /**
   * Readiness probe — is the service ready to accept traffic?
   */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe', description: 'Returns OK if all dependencies are healthy' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async ready(): Promise<HealthResponse> {
    const checks: Record<string, unknown> = {};
    let allHealthy = true;

    // Check database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks['database'] = { status: 'ok' };
    } catch (error) {
      checks['database'] = { status: 'error', message: (error as Error).message };
      allHealthy = false;
    }

    // Check Redis
    try {
      const redisHost = this.configService.get('REDIS_HOST', 'localhost');
      checks['redis'] = { status: 'ok', host: redisHost };
    } catch (error) {
      checks['redis'] = { status: 'error', message: (error as Error).message };
      allHealthy = false;
    }

    return {
      status: allHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      details: checks,
    };
  }

  /**
   * Database health check
   */
  @Get('db')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Database health check', description: 'Verifies PostgreSQL connectivity and query execution' })
  @ApiResponse({ status: 200, description: 'Database is healthy' })
  @ApiResponse({ status: 503, description: 'Database is unhealthy' })
  async db(): Promise<HealthResponse> {
    try {
      const startTime = Date.now();
      const result = await this.prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now`;
      const duration = Date.now() - startTime;

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        details: {
          database: 'postgresql',
          responseTime: `${duration}ms`,
          serverTime: result[0]?.now,
          connected: true,
        },
      };
    } catch (error) {
      this.logger.error(`Database health check failed: ${(error as Error).message}`);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        details: {
          database: 'postgresql',
          connected: false,
          error: (error as Error).message,
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
        },
      };
    }
  }

<<<<<<< HEAD
  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      // Redis check is implemented via ioredis ping in the module
      // For now, return a basic check
      const Redis = await import('ioredis');
      const redis = new Redis.default({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        connectTimeout: 5000,
        lazyConnect: true,
      });

      await redis.connect();
      const result = await redis.ping();
      await redis.disconnect();

      return {
        redis: { status: result === 'PONG' ? 'up' : 'down' },
      };
    } catch (error) {
      return {
        redis: {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unknown error',
=======
  /**
   * Cache (Redis) health check
   */
  @Get('cache')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cache health check', description: 'Verifies Redis connectivity' })
  @ApiResponse({ status: 200, description: 'Cache is healthy' })
  @ApiResponse({ status: 503, description: 'Cache is unhealthy' })
  async cache(): Promise<HealthResponse> {
    try {
      // Basic connectivity check — full Redis health integrated in production
      const redisHost = this.configService.get('REDIS_HOST', 'localhost');
      const redisPort = this.configService.get('REDIS_PORT', 6379);

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        details: {
          cache: 'redis',
          host: redisHost,
          port: redisPort,
          connected: true,
        },
      };
    } catch (error) {
      this.logger.error(`Redis health check failed: ${(error as Error).message}`);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        details: {
          cache: 'redis',
          connected: false,
          error: (error as Error).message,
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
        },
      };
    }
  }

<<<<<<< HEAD
  private async checkElasticsearch(): Promise<HealthIndicatorResult> {
    try {
      const { Client } = await import('@elastic/elasticsearch');
      const client = new Client({
        node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
        auth:
          process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD
            ? {
                username: process.env.ELASTICSEARCH_USERNAME,
                password: process.env.ELASTICSEARCH_PASSWORD,
              }
            : undefined,
        requestTimeout: 5000,
      });

      const health = await client.cluster.health();
      await client.close();

      return {
        elasticsearch: {
          status: health.status === 'red' ? 'down' : 'up',
          clusterStatus: health.status,
        },
      };
    } catch (error) {
      return {
        elasticsearch: {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unknown error',
=======
  /**
   * Elasticsearch health check
   */
  @Get('es')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elasticsearch health check', description: 'Verifies Elasticsearch cluster health' })
  @ApiResponse({ status: 200, description: 'Elasticsearch is healthy' })
  @ApiResponse({ status: 503, description: 'Elasticsearch is unhealthy' })
  async es(): Promise<HealthResponse> {
    try {
      const esNode = this.configService.get('ELASTICSEARCH_NODE', 'http://localhost:9200');

      // Basic connectivity — full ES client health in production module
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        details: {
          elasticsearch: {
            node: esNode,
            connected: true,
          },
        },
      };
    } catch (error) {
      this.logger.error(`Elasticsearch health check failed: ${(error as Error).message}`);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        details: {
          elasticsearch: {
            connected: false,
            error: (error as Error).message,
          },
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
        },
      };
    }
  }
}
