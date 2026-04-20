import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Pagination result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Base query options
 */
export interface BaseQueryOptions {
  page?: number;
  pageSize?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
  includeDeleted?: boolean;
}

/**
 * Abstract base repository providing CRUD operations with
 * tenant isolation, soft-delete handling, and pagination.
 *
 * All concrete repositories should extend this class.
 *
 * @template T - The entity type
 * @template CreateInput - The create DTO type
 * @template UpdateInput - The update DTO type
 */
export abstract class BaseRepository<
  T extends Record<string, any>,
  CreateInput extends Record<string, any> = Record<string, any>,
  UpdateInput extends Record<string, any> = Record<string, any>,
> {
  protected readonly logger: Logger;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly modelName: string,
  ) {
    this.logger = new Logger(`${modelName}Repository`);
  }

  /**
   * Get the Prisma delegate for this model (e.g., prisma.user, prisma.account).
   */
  protected abstract getDelegate(): any;

  /**
   * Find all records with pagination, tenant filtering, and optional soft-delete inclusion.
   */
  async findAll(
    tenantId: string,
    options: BaseQueryOptions = {},
  ): Promise<PaginatedResult<T>> {
    const {
      page = 1,
      pageSize = 20,
      orderBy = { createdAt: 'desc' as const },
      includeDeleted = false,
    } = options;

    const where: Record<string, any> = { tenantId };
    if (!includeDeleted) {
      where.deletedAt = null;
    }

    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.getDelegate().findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
      }),
      this.getDelegate().count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Find a single record by ID with tenant isolation.
   */
  async findById(
    id: string,
    tenantId: string,
    include?: Record<string, boolean>,
  ): Promise<T | null> {
    return this.getDelegate().findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      ...(include ? { include } : {}),
    });
  }

  /**
   * Find records matching a filter with tenant isolation.
   */
  async findWhere(
    tenantId: string,
    filter: Record<string, any>,
    options: BaseQueryOptions = {},
  ): Promise<PaginatedResult<T>> {
    const {
      page = 1,
      pageSize = 20,
      orderBy = { createdAt: 'desc' as const },
      includeDeleted = false,
    } = options;

    const where: Record<string, any> = { ...filter, tenantId };
    if (!includeDeleted) {
      where.deletedAt = null;
    }

    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.getDelegate().findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
      }),
      this.getDelegate().count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Create a new record with tenant context.
   */
  async create(tenantId: string, data: CreateInput): Promise<T> {
    this.logger.debug(`Creating ${this.modelName} for tenant ${tenantId}`);
    return this.getDelegate().create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  /**
   * Create multiple records in a batch.
   */
  async createMany(
    tenantId: string,
    data: CreateInput[],
  ): Promise<{ count: number }> {
    this.logger.debug(
      `Batch creating ${data.length} ${this.modelName} records for tenant ${tenantId}`,
    );
    return this.getDelegate().createMany({
      data: data.map((item) => ({ ...item, tenantId })),
      skipDuplicates: true,
    });
  }

  /**
   * Update a record by ID with tenant isolation.
   */
  async update(
    id: string,
    tenantId: string,
    data: UpdateInput,
  ): Promise<T | null> {
    // Verify the record belongs to the tenant
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      return null;
    }

    return this.getDelegate().update({
      where: { id },
      data,
    });
  }

  /**
   * Soft-delete a record by ID with tenant isolation.
   */
  async softDelete(id: string, tenantId: string): Promise<T | null> {
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      return null;
    }

    return this.getDelegate().update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft-deleted record.
   */
  async restore(id: string, tenantId: string): Promise<T | null> {
    const existing = await this.getDelegate().findFirst({
      where: {
        id,
        tenantId,
        deletedAt: { not: null },
      },
    });

    if (!existing) {
      return null;
    }

    return this.getDelegate().update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  /**
   * Permanently delete a record (USE WITH CAUTION).
   */
  async hardDelete(id: string, tenantId: string): Promise<boolean> {
    const existing = await this.getDelegate().findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return false;
    }

    await this.getDelegate().delete({ where: { id } });
    return true;
  }

  /**
   * Count records matching a filter.
   */
  async count(
    tenantId: string,
    filter: Record<string, any> = {},
  ): Promise<number> {
    return this.getDelegate().count({
      where: {
        ...filter,
        tenantId,
        deletedAt: null,
      },
    });
  }

  /**
   * Check if a record exists.
   */
  async exists(
    tenantId: string,
    filter: Record<string, any>,
  ): Promise<boolean> {
    const count = await this.getDelegate().count({
      where: {
        ...filter,
        tenantId,
        deletedAt: null,
      },
    });
    return count > 0;
  }
}
