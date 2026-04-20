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
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  /**
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
        },
      };
    }
  }

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
        },
      };
    }
  }

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
        },
      };
    }
  }
}
