import { Controller, Get, Logger } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

/**
 * HealthController provides endpoints for liveness, readiness, and dependency health checks.
 * Integrates with NestJS Terminus for standardized health reporting.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly health: HealthCheckService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /health/live
   * Liveness probe — returns 200 if the application process is running.
   */
  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  async checkLiveness(): Promise<HealthCheckResult> {
    return this.health.check([
      () =>
        Promise.resolve<HealthIndicatorResult>({
          app: {
            status: 'up',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            version: this.configService.get('APP_VERSION', '1.0.0'),
          },
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
   * PostgreSQL connectivity check.
   */
  @Get('db')
  @HealthCheck()
  @ApiOperation({ summary: 'Database health check' })
  @ApiResponse({ status: 200, description: 'Database is connected' })
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
  async checkEs(): Promise<HealthCheckResult> {
    return this.health.check([() => this.checkElasticsearch()]);
  }

  // ── Private health indicator methods ──────────────────────

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: 'up' } };
    } catch (error) {
      this.logger.error(`Database health check failed: ${(error as Error).message}`);
      return {
        database: {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unreachable',
        },
      };
    }
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      const Redis = (await import('ioredis')).default;
      const redis = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get('REDIS_PORT', 6379),
        password: this.configService.get('REDIS_PASSWORD') || undefined,
        connectTimeout: 2000,
        lazyConnect: true,
      });

      await redis.connect();
      const result = await redis.ping();
      await redis.disconnect();

      return {
        redis: { status: result === 'PONG' ? 'up' : 'down' },
      };
    } catch (error) {
      this.logger.error(`Redis health check failed: ${(error as Error).message}`);
      return {
        redis: {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unreachable',
        },
      };
    }
  }

  private async checkElasticsearch(): Promise<HealthIndicatorResult> {
    try {
      const { Client } = await import('@elastic/elasticsearch');
      const client = new Client({
        node: this.configService.get('ELASTICSEARCH_NODE', 'http://localhost:9200'),
        requestTimeout: 2000,
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
      this.logger.error(`Elasticsearch health check failed: ${(error as Error).message}`);
      return {
        elasticsearch: {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unreachable',
        },
      };
    }
  }
}
