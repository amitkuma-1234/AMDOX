import { Injectable } from '@nestjs/common';
import { Transaction, TransactionType, Prisma, Currency } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

/**
 * Cursor-based pagination options for transaction queries.
 */
export interface TransactionCursorOptions {
  cursor?: string;
  take?: number;
  accountId?: string;
  type?: TransactionType;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Repository for Transaction entities with optimised queries,
 * cursor-based pagination, and date-range filtering.
 */
@Injectable()
export class TransactionRepository extends BaseRepository<Transaction> {
  protected readonly modelName = 'Transaction';

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate() {
    return this.prisma.transaction;
  }

  /**
   * Override findById — transactions don't have direct tenantId,
   * so we check via the Account relationship.
   */
  async findById(id: string, tenantId: string): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({
      where: {
        id,
        account: { tenantId },
      },
      include: {
        account: { select: { id: true, accountName: true, glCode: true, tenantId: true } },
        journalEntry: { select: { id: true, reference: true, status: true } },
      },
    });
  }

  /**
   * Cursor-based pagination for high-volume transaction lists.
   */
  async findWithCursor(tenantId: string, options: TransactionCursorOptions = {}) {
    const {
      cursor,
      take = 50,
      accountId,
      type,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
    } = options;

    const where: Prisma.TransactionWhereInput = {
      account: { tenantId },
      ...(accountId && { accountId }),
      ...(type && { type }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: dateFrom }),
              ...(dateTo && { lte: dateTo }),
            },
          }
        : {}),
      ...(minAmount || maxAmount
        ? {
            amount: {
              ...(minAmount && { gte: new Prisma.Decimal(minAmount) }),
              ...(maxAmount && { lte: new Prisma.Decimal(maxAmount) }),
            },
          }
        : {}),
    };

    const transactions = await this.prisma.transaction.findMany({
      where,
      take: take + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        account: { select: { id: true, accountName: true, glCode: true } },
        journalEntry: { select: { id: true, reference: true } },
      },
    });

    const hasNextPage = transactions.length > take;
    const data = hasNextPage ? transactions.slice(0, take) : transactions;
    const nextCursor = hasNextPage ? data[data.length - 1].id : null;

    return {
      data,
      meta: {
        hasNextPage,
        nextCursor,
        count: data.length,
      },
    };
  }

  /**
   * Aggregate transaction totals by type for an account.
   */
  async getAccountTotals(accountId: string, tenantId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, tenantId },
    });

    if (!account) {
      throw new Error(`Account ${accountId} not found in tenant ${tenantId}`);
    }

    const result = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { accountId, deletedAt: null },
      _sum: { amount: true },
      _count: { id: true },
    });

    const totals: Record<string, { sum: Prisma.Decimal; count: number }> = {};
    for (const group of result) {
      totals[group.type] = {
        sum: group._sum.amount || new Prisma.Decimal(0),
        count: group._count.id,
      };
    }

    return {
      accountId,
      accountName: account.accountName,
      glCode: account.glCode,
      currency: account.currency,
      debits: totals['DEBIT'] || { sum: new Prisma.Decimal(0), count: 0 },
      credits: totals['CREDIT'] || { sum: new Prisma.Decimal(0), count: 0 },
      netBalance: account.balance,
    };
  }

  /**
   * Batch create transactions within a journal entry.
   */
  async createBatch(
    transactions: Array<{
      accountId: string;
      amount: number;
      type: TransactionType;
      currency?: Currency;
      description?: string;
      reference?: string;
      journalEntryId?: string;
      postingDate?: Date;
    }>,
  ) {
    return this.prisma.$transaction(
      transactions.map((tx) =>
        this.prisma.transaction.create({
          data: {
            accountId: tx.accountId,
            amount: new Prisma.Decimal(tx.amount),
            type: tx.type,
            currency: tx.currency || Currency.USD,
            description: tx.description,
            reference: tx.reference,
            journalEntryId: tx.journalEntryId,
            postingDate: tx.postingDate || new Date(),
          },
        }),
      ),
    );
  }

  /**
   * Get daily transaction volume summary for a tenant.
   */
  async getDailyVolume(tenantId: string, days: number = 30) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const result = await this.prisma.$queryRaw<
      Array<{ date: Date; debit_total: number; credit_total: number; count: number }>
    >`
      SELECT
        DATE(t.created_at) as date,
        SUM(CASE WHEN t.type = 'DEBIT' THEN t.amount ELSE 0 END) as debit_total,
        SUM(CASE WHEN t.type = 'CREDIT' THEN t.amount ELSE 0 END) as credit_total,
        COUNT(*)::int as count
      FROM transactions t
      INNER JOIN accounts a ON t.account_id = a.id
      WHERE a.tenant_id = ${tenantId}::uuid
        AND t.created_at >= ${fromDate}
        AND t.deleted_at IS NULL
      GROUP BY DATE(t.created_at)
      ORDER BY date DESC
    `;

    return result;
  }
}
