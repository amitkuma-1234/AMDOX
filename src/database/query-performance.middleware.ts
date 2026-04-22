import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Query performance monitoring middleware for Prisma.
 * Tracks slow queries, logs performance metrics, and provides
 * configurable thresholds for alerting.
 */
export interface QueryMetrics {
  model: string | undefined;
  action: string;
  duration: number;
  timestamp: Date;
  slow: boolean;
}

export class QueryPerformanceMonitor {
  private readonly logger = new Logger(QueryPerformanceMonitor.name);
  private readonly metrics: QueryMetrics[] = [];
  private readonly maxMetrics = 1000;

  constructor(
    private readonly slowQueryThreshold: number = 500, // ms
    private readonly verySlowQueryThreshold: number = 2000, // ms
  ) {}

  /**
   * Create a Prisma middleware that monitors query performance.
   */
  createMiddleware(): Prisma.Middleware {
    return async (
      params: Prisma.MiddlewareParams,
      next: (params: Prisma.MiddlewareParams) => Promise<any>,
    ) => {
      const startTime = Date.now();

      try {
        const result = await next(params);
        const duration = Date.now() - startTime;

        this.recordMetrics(params.model, params.action, duration);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.logger.error(
          `Query error on ${params.model}.${params.action} after ${duration}ms: ${(error as Error).message}`,
        );
        throw error;
      }
    };
  }

  /**
   * Record query metrics and log slow queries.
   */
  private recordMetrics(model: string | undefined, action: string, duration: number): void {
    const isSlow = duration >= this.slowQueryThreshold;
    const isVerySlow = duration >= this.verySlowQueryThreshold;

    const metric: QueryMetrics = {
      model,
      action,
      duration,
      timestamp: new Date(),
      slow: isSlow,
    };

    // Store metric (circular buffer)
    if (this.metrics.length >= this.maxMetrics) {
      this.metrics.shift();
    }
    this.metrics.push(metric);

    // Log warnings
    if (isVerySlow) {
      this.logger.error(`🔴 Very slow query: ${model}.${action} took ${duration}ms`);
    } else if (isSlow) {
      this.logger.warn(`🟡 Slow query: ${model}.${action} took ${duration}ms`);
    }
  }

  /**
   * Get aggregated performance statistics.
   */
  getStats(): {
    totalQueries: number;
    slowQueries: number;
    averageDuration: number;
    maxDuration: number;
    queriesByModel: Record<string, number>;
  } {
    const totalQueries = this.metrics.length;
    const slowQueries = this.metrics.filter((m) => m.slow).length;
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = totalQueries > 0 ? Math.round(totalDuration / totalQueries) : 0;
    const maxDuration = totalQueries > 0 ? Math.max(...this.metrics.map((m) => m.duration)) : 0;

    const queriesByModel: Record<string, number> = {};
    for (const metric of this.metrics) {
      const key = metric.model || 'unknown';
      queriesByModel[key] = (queriesByModel[key] || 0) + 1;
    }

    return {
      totalQueries,
      slowQueries,
      averageDuration,
      maxDuration,
      queriesByModel,
    };
  }

  /**
   * Get recent slow queries.
   */
  getSlowQueries(limit = 20): QueryMetrics[] {
    return this.metrics
      .filter((m) => m.slow)
      .slice(-limit)
      .reverse();
  }

  /**
   * Clear all recorded metrics.
   */
  clearMetrics(): void {
    this.metrics.length = 0;
  }
}
