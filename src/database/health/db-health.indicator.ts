import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../prisma.service';

/**
 * Database health indicator for NestJS Terminus.
 * Executes SELECT 1 against PostgreSQL to verify connectivity.
 */
@Injectable()
export class DbHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(DbHealthIndicator.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const startTime = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const duration = Date.now() - startTime;

      return this.getStatus(key, true, { responseTimeMs: duration });
    } catch (error) {
      this.logger.error(`Database health check failed: ${(error as Error).message}`);
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false, {
          message: (error as Error).message,
        }),
      );
    }
  }
}
