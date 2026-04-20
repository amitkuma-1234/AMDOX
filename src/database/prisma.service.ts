import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * PrismaService extends PrismaClient with NestJS lifecycle hooks,
 * query performance monitoring, and soft-delete middleware.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });

    this.setupQueryLogging();
    this.setupSoftDeleteMiddleware();
  }

  async onModuleInit() {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('Database connected successfully');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Log slow queries (> 500ms) for performance monitoring.
   */
  private setupQueryLogging() {
    (this as any).$on('query', (event: any) => {
      const duration = event.duration;
      if (duration > 500) {
        this.logger.warn(
          `SLOW QUERY (${duration}ms): ${event.query} — Params: ${event.params}`,
        );
      }
    });
  }

  /**
   * Soft-delete middleware:
   * - findMany/findFirst: auto-filter where deletedAt IS NULL
   * - delete: convert to update setting deletedAt = now()
   * - deleteMany: convert to updateMany setting deletedAt = now()
   *
   * Models without deletedAt (e.g., AuditLog) are excluded.
   */
  private setupSoftDeleteMiddleware() {
    // Models that support soft-delete (have deletedAt field)
    const softDeleteModels = [
      'Tenant',
      'User',
      'Role',
      'Account',
      'Transaction',
      'JournalEntry',
      'Employee',
      'PurchaseOrder',
      'InventoryItem',
      'Notification',
    ];

    // Auto-filter soft-deleted records on read
    this.$use(async (params: Prisma.MiddlewareParams, next) => {
      if (
        params.model &&
        softDeleteModels.includes(params.model) &&
        (params.action === 'findMany' ||
          params.action === 'findFirst' ||
          params.action === 'findUnique' ||
          params.action === 'count')
      ) {
        if (!params.args) {
          params.args = {};
        }
        if (!params.args.where) {
          params.args.where = {};
        }

        // Only apply if deletedAt filter is not explicitly set
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      }

      return next(params);
    });

    // Convert delete to soft-delete
    this.$use(async (params: Prisma.MiddlewareParams, next) => {
      if (
        params.model &&
        softDeleteModels.includes(params.model)
      ) {
        if (params.action === 'delete') {
          params.action = 'update';
          params.args.data = { deletedAt: new Date() };
        }

        if (params.action === 'deleteMany') {
          params.action = 'updateMany';
          if (!params.args.data) {
            params.args.data = {};
          }
          params.args.data.deletedAt = new Date();
        }
      }

      return next(params);
    });
  }

  /**
   * Health check query — used by /health/db endpoint.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute operations within a transaction.
   */
  async executeInTransaction<T>(
    fn: (prisma: Prisma.TransactionClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T> {
    return this.$transaction(fn, {
      maxWait: options?.maxWait || 5000,
      timeout: options?.timeout || 10000,
    });
  }
}
