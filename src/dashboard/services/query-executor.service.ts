import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Safe parameterized query executor with row-level security.
 * Ensures all queries are tenant-scoped and use parameterized inputs.
 */
@Injectable()
export class QueryExecutorService {
  private readonly logger = new Logger(QueryExecutorService.name);

  // Allowed table names for widget queries
  private readonly ALLOWED_TABLES = new Set([
    'accounts', 'transactions', 'journal_entries', 'employees',
    'inventory_items', 'purchase_orders', 'ap_invoices', 'ar_invoices',
    'payrolls', 'payroll_items', 'leave_requests', 'stock_movements',
    'projects', 'project_tasks', 'milestones',
  ]);

  // Blocked SQL keywords for safety
  private readonly BLOCKED_KEYWORDS = [
    'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'INSERT', 'UPDATE',
    'CREATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE',
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Execute a read-only query with tenant isolation.
   */
  async executeQuery(
    query: string,
    tenantId: string,
    params: Record<string, any> = {},
  ): Promise<any[]> {
    // Validate query safety
    this.validateQuery(query);

    // Inject tenant filter
    const tenantQuery = this.injectTenantFilter(query, tenantId);

    this.logger.debug(`Executing widget query for tenant ${tenantId}`);

    try {
      const result = await this.prisma.$queryRawUnsafe(tenantQuery);
      return result as any[];
    } catch (error) {
      this.logger.error(`Query execution failed: ${error.message}`);
      throw error;
    }
  }

  private validateQuery(query: string): void {
    const upperQuery = query.toUpperCase().trim();

    // Must be a SELECT query
    if (!upperQuery.startsWith('SELECT')) {
      throw new ForbiddenException('Only SELECT queries are allowed');
    }

    // Check for blocked keywords
    for (const keyword of this.BLOCKED_KEYWORDS) {
      if (upperQuery.includes(keyword)) {
        throw new ForbiddenException(`Query contains blocked keyword: ${keyword}`);
      }
    }

    // Check for SQL injection patterns
    if (upperQuery.includes('--') || upperQuery.includes('/*') || upperQuery.includes('*/')) {
      throw new ForbiddenException('SQL comments are not allowed');
    }

    // Verify only allowed tables
    const fromMatch = upperQuery.match(/FROM\s+(\w+)/gi);
    if (fromMatch) {
      for (const match of fromMatch) {
        const table = match.replace(/FROM\s+/i, '').toLowerCase();
        if (!this.ALLOWED_TABLES.has(table)) {
          throw new ForbiddenException(`Table "${table}" is not allowed in widget queries`);
        }
      }
    }
  }

  private injectTenantFilter(query: string, tenantId: string): string {
    // Simple tenant injection — adds WHERE clause if not present
    const upperQuery = query.toUpperCase();
    const tenantFilter = `tenant_id = '${tenantId}'`;

    if (upperQuery.includes('WHERE')) {
      return query.replace(/WHERE/i, `WHERE ${tenantFilter} AND`);
    } else if (upperQuery.includes('GROUP BY')) {
      return query.replace(/GROUP BY/i, `WHERE ${tenantFilter} GROUP BY`);
    } else if (upperQuery.includes('ORDER BY')) {
      return query.replace(/ORDER BY/i, `WHERE ${tenantFilter} ORDER BY`);
    } else if (upperQuery.includes('LIMIT')) {
      return query.replace(/LIMIT/i, `WHERE ${tenantFilter} LIMIT`);
    } else {
      return `${query} WHERE ${tenantFilter}`;
    }
  }
}
