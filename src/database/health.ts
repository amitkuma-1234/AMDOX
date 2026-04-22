import { PrismaService } from '../database/prisma.service';

/**
 * Database health check utility.
 * Provides methods for checking database connectivity and performance.
 */
export async function checkDatabaseHealth(prisma: PrismaService): Promise<{
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  details: Record<string, unknown>;
}> {
  const startTime = Date.now();

  try {
    // Basic connectivity
    const result = await prisma.$queryRaw<Array<{ now: Date; version: string }>>`
      SELECT NOW() as now, version() as version
    `;

    const responseTime = Date.now() - startTime;
    const status = responseTime > 1000 ? 'degraded' : 'healthy';

    // Check connection pool
    const poolStats = await prisma.$queryRaw<
      Array<{
        active: number;
        idle: number;
        max: number;
      }>
    >`
      SELECT 
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    return {
      status,
      responseTime,
      details: {
        serverTime: result[0]?.now,
        version: result[0]?.version,
        pool: poolStats[0] || {},
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: {
        error: (error as Error).message,
      },
    };
  }
}
