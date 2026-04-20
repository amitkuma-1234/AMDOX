import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * Pagination options for list queries.
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result wrapper.
 */
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Abstract base repository providing tenant-scoped CRUD operations.
 * All concrete repositories extend this class.
 *
 * Key features:
 * - Automatic tenantId injection in all queries
 * - Soft-delete support (via PrismaService middleware)
 * - Pagination helpers
 * - Type-safe generic interface
 */
@Injectable()
export abstract class BaseRepository<T> {
  protected readonly logger: Logger;
  protected abstract readonly modelName: string;

  constructor(protected readonly prisma: PrismaService) {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Get the Prisma delegate for the model.
   * Each subclass implements this to return the correct model delegate.
   */
  protected abstract getDelegate(): any;

  /**
   * Find a single record by ID within a tenant.
   */
  async findById(id: string, tenantId: string): Promise<T | null> {
    try {
      return await this.getDelegate().findFirst({
        where: { id, tenantId },
      });
    } catch (error) {
      this.logger.error(`findById failed for ${this.modelName}:${id} — ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Find all records for a tenant with pagination.
   */
  async findAll(
    tenantId: string,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult<T>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const skip = (page - 1) * limit;

    try {
      const [data, total] = await Promise.all([
        this.getDelegate().findMany({
          where: { tenantId },
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        this.getDelegate().count({
          where: { tenantId },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(`findAll failed for ${this.modelName} — ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Create a new record within a tenant.
   */
  async create(data: Partial<T> & { tenantId: string }): Promise<T> {
    try {
      return await this.getDelegate().create({ data });
    } catch (error) {
      this.logger.error(`create failed for ${this.modelName} — ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Update a record by ID within a tenant.
   */
  async update(id: string, tenantId: string, data: Partial<T>): Promise<T> {
    // Verify record belongs to tenant before updating
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw new Error(`${this.modelName} with id ${id} not found in tenant ${tenantId}`);
    }

    try {
      return await this.getDelegate().update({
        where: { id },
        data,
      });
    } catch (error) {
      this.logger.error(`update failed for ${this.modelName}:${id} — ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Soft-delete a record by ID within a tenant.
   * (Actual soft-delete is handled by PrismaService middleware.)
   */
  async softDelete(id: string, tenantId: string): Promise<T> {
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw new Error(`${this.modelName} with id ${id} not found in tenant ${tenantId}`);
    }

    try {
      return await this.getDelegate().delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`softDelete failed for ${this.modelName}:${id} — ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Count records for a tenant with optional filter.
   */
  async count(tenantId: string, where: Record<string, any> = {}): Promise<number> {
    try {
      return await this.getDelegate().count({
        where: { ...where, tenantId },
      });
    } catch (error) {
      this.logger.error(`count failed for ${this.modelName} — ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Check if a record exists within a tenant.
   */
  async exists(id: string, tenantId: string): Promise<boolean> {
    const record = await this.findById(id, tenantId);
    return record !== null;
  }
}
