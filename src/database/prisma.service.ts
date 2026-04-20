import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

/**
 * PrismaService extends PrismaClient with lifecycle hooks,
 * soft-delete middleware, query logging, and performance monitoring.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    const logLevels: Prisma.LogLevel[] =
      configService.get('NODE_ENV') === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'];

    super({
      log: logLevels.map((level) => ({
        emit: 'event' as const,
        level,
      })),
      errorFormat: 'pretty',
    });

    // ── Query Logging ─────────────────────────────────────────
    (this as any).$on('query', (event: Prisma.QueryEvent) => {
      if (event.duration > 500) {
        this.logger.warn(
          `⚠ Slow query (${event.duration}ms): ${event.query.substring(0, 200)}`,
        );
      } else if (configService.get('NODE_ENV') === 'development') {
        this.logger.debug(`Query (${event.duration}ms): ${event.query.substring(0, 150)}`);
      }
    });

    (this as any).$on('error', (event: Prisma.LogEvent) => {
      this.logger.error(`Prisma error: ${event.message}`);
    });

    (this as any).$on('warn', (event: Prisma.LogEvent) => {
      this.logger.warn(`Prisma warning: ${event.message}`);
    });
  }

  async onModuleInit() {
    this.logger.log('Connecting to database...');

    // ── Soft-delete Middleware ─────────────────────────────────
    this.applySoftDeleteMiddleware();

    try {
      await this.$connect();
      this.logger.log('✅ Database connection established');
    } catch (error) {
      this.logger.error(`❌ Database connection failed: ${(error as Error).message}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Apply soft-delete middleware to intercept delete operations.
   * Converts `delete` → `update { deletedAt }` and `deleteMany` → `updateMany { deletedAt }`.
   * Also filters out soft-deleted records from `findMany`, `findFirst`, `findUnique`, and `count`.
   */
  private applySoftDeleteMiddleware() {
    // Models that support soft-delete
    const softDeleteModels = [
      'Tenant',
      'User',
      'Role',
      'Account',
      'Transaction',
      'JournalEntry',
      'Employee',
      'Vendor',
      'PurchaseOrder',
      'InventoryItem',
    ];

    // Intercept delete → soft-delete
    this.$use(async (params: Prisma.MiddlewareParams, next) => {
      if (params.model && softDeleteModels.includes(params.model)) {
        // Convert delete to soft-delete
        if (params.action === 'delete') {
          params.action = 'update';
          params.args['data'] = { deletedAt: new Date() };
        }

        // Convert deleteMany to soft-delete
        if (params.action === 'deleteMany') {
          params.action = 'updateMany';
          if (params.args.data !== undefined) {
            params.args.data['deletedAt'] = new Date();
          } else {
            params.args['data'] = { deletedAt: new Date() };
          }
        }

        // Filter out soft-deleted records from reads
        if (
          params.action === 'findFirst' ||
          params.action === 'findMany' ||
          params.action === 'count'
        ) {
          // Check if caller explicitly wants deleted records
          if (params.args?.where?.deletedAt !== undefined) {
            // Caller explicitly set deletedAt filter — respect it
          } else {
            if (!params.args) {
              params.args = {};
            }
            if (!params.args.where) {
              params.args.where = {};
            }
            params.args.where['deletedAt'] = null;
          }
        }

        if (params.action === 'findUnique' || params.action === 'findFirst') {
          // findUnique cannot have deletedAt filter directly,
          // convert to findFirst for soft-delete check
          if (params.action === 'findUnique') {
            params.action = 'findFirst';
            if (!params.args.where?.deletedAt) {
              params.args.where['deletedAt'] = null;
            }
          }
        }
      }

      return next(params);
    });
  }

  /**
   * Health check query — verifies database connectivity.
   */
  async healthCheck(): Promise<{
    connected: boolean;
    responseTime: number;
    serverTime?: Date;
  }> {
    const start = Date.now();
    try {
      const result = await this.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now`;
      return {
        connected: true,
        responseTime: Date.now() - start,
        serverTime: result[0]?.now,
      };
    } catch {
      return {
        connected: false,
        responseTime: Date.now() - start,
      };
    }
  }

  /**
   * Clean database — for testing only.
   * Deletes all data in reverse dependency order.
   */
  async cleanDatabase() {
    if (this.configService.get('NODE_ENV') === 'production') {
      throw new Error('Cannot clean database in production!');
    }

    const models = Prisma.dmmf.datamodel.models.map((m) => m.name);
    this.logger.warn(`🧹 Cleaning database (${models.length} tables)...`);

    for (const model of models.reverse()) {
      const tableName = model
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .slice(1);
      try {
        await this.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE`);
      } catch {
        // Table may not exist yet
      }
    }
  }
}
