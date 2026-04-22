import { Injectable } from '@nestjs/common';
import { Transaction, Prisma, TransactionType, TransactionStatus } from '@prisma/client';
import { BaseRepository, PaginatedResult, BaseQueryOptions } from '../database/base.repository';
import { PrismaService } from '../database/prisma.service';

/**
 * TransactionRepository provides optimized data access for financial transactions.
 * Includes batch operations, aggregate queries, and period-based reporting.
 */
@Injectable()
export class TransactionRepository extends BaseRepository<Transaction> {
  constructor(prisma: PrismaService) {
    super(prisma, 'Transaction');
  }

  protected getDelegate() {
    return this.prisma.transaction;
  }

  /**
   * Find transactions by account with optional date range filtering.
   */
  async findByAccount(
    accountId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      type?: TransactionType;
      status?: TransactionStatus;
    } & BaseQueryOptions = {},
  ): Promise<PaginatedResult<Transaction>> {
    const { page = 1, pageSize = 50, startDate, endDate, type, status } = options;

    const skip = (page - 1) * pageSize;

    const where: Prisma.TransactionWhereInput = {
      accountId,
      deletedAt: null,
      ...(type && { type }),
      ...(status && { status }),
      ...(startDate || endDate
        ? {
            postingDate: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { postingDate: 'desc' },
        include: {
          account: {
            select: {
              id: true,
              accountName: true,
              glCode: true,
              currency: true,
            },
          },
          journalEntry: {
            select: {
              id: true,
              reference: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.transaction.count({ where }),
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
   * Get account balance for a specific date range.
   */
  async getAccountBalance(
    accountId: string,
    options: { startDate?: Date; endDate?: Date } = {},
  ): Promise<{
    totalDebit: number;
    totalCredit: number;
    netBalance: number;
    transactionCount: number;
  }> {
    const where: Prisma.TransactionWhereInput = {
      accountId,
      status: 'POSTED',
      deletedAt: null,
      ...(options.startDate || options.endDate
        ? {
            postingDate: {
              ...(options.startDate && { gte: options.startDate }),
              ...(options.endDate && { lte: options.endDate }),
            },
          }
        : {}),
    };

    const [debitResult, creditResult, count] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...where, type: 'DEBIT' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...where, type: 'CREDIT' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    const totalDebit = Number(debitResult._sum.amount || 0);
    const totalCredit = Number(creditResult._sum.amount || 0);

    return {
      totalDebit,
      totalCredit,
      netBalance: totalDebit - totalCredit,
      transactionCount: count,
    };
  }

  /**
   * Batch create transactions (for journal entry posting).
   * Uses a Prisma transaction to ensure atomicity.
   */
  async batchCreate(
    transactions: Array<{
      accountId: string;
      amount: number;
      type: TransactionType;
      description?: string;
      reference?: string;
      postingDate: Date;
      journalEntryId?: string;
      exchangeRate?: number;
      baseCurrencyAmt?: number;
    }>,
  ): Promise<Transaction[]> {
    return this.prisma.$transaction(
      transactions.map((tx) =>
        this.prisma.transaction.create({
          data: {
            accountId: tx.accountId,
            amount: tx.amount,
            type: tx.type,
            status: 'PENDING',
            description: tx.description,
            reference: tx.reference,
            postingDate: tx.postingDate,
            journalEntryId: tx.journalEntryId,
            exchangeRate: tx.exchangeRate,
            baseCurrencyAmt: tx.baseCurrencyAmt,
          },
        }),
      ),
    );
  }

  /**
   * Post pending transactions (change status to POSTED).
   */
  async postTransactions(transactionIds: string[]): Promise<number> {
    const result = await this.prisma.transaction.updateMany({
      where: {
        id: { in: transactionIds },
        status: 'PENDING',
        deletedAt: null,
      },
      data: {
        status: 'POSTED',
      },
    });

    return result.count;
  }

  /**
   * Void transactions (change status to VOIDED).
   */
  async voidTransactions(transactionIds: string[], reason?: string): Promise<number> {
    const result = await this.prisma.transaction.updateMany({
      where: {
        id: { in: transactionIds },
        status: { in: ['PENDING', 'POSTED'] },
        deletedAt: null,
      },
      data: {
        status: 'VOIDED',
        description: reason ? Prisma.DbNull : undefined,
      },
    });

    return result.count;
  }

  /**
   * Get transaction summary grouped by date for a period.
   */
  async getDailySummary(
    accountId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<
    Array<{
      date: Date;
      totalDebit: number;
      totalCredit: number;
      count: number;
    }>
  > {
    const result = await this.prisma.$queryRaw<
      Array<{
        posting_date: Date;
        total_debit: string;
        total_credit: string;
        count: bigint;
      }>
    >`
      SELECT 
        posting_date,
        COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0) as total_debit,
        COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0) as total_credit,
        COUNT(*) as count
      FROM transactions
      WHERE account_id = ${accountId}::uuid
        AND posting_date >= ${startDate}
        AND posting_date <= ${endDate}
        AND status = 'POSTED'
        AND deleted_at IS NULL
      GROUP BY posting_date
      ORDER BY posting_date ASC
    `;

    return result.map((r) => ({
      date: r.posting_date,
      totalDebit: parseFloat(r.total_debit),
      totalCredit: parseFloat(r.total_credit),
      count: Number(r.count),
    }));
  }

  /**
   * Get trial balance data for all accounts in a tenant.
   */
  async getTrialBalance(
    tenantId: string,
    asOfDate?: Date,
  ): Promise<
    Array<{
      accountId: string;
      accountName: string;
      glCode: string;
      accountType: string;
      totalDebit: number;
      totalCredit: number;
      balance: number;
    }>
  > {
    const dateFilter = asOfDate ? Prisma.sql`AND t.posting_date <= ${asOfDate}` : Prisma.empty;

    return this.prisma.$queryRaw`
      SELECT 
        a.id as "accountId",
        a.account_name as "accountName",
        a.gl_code as "glCode",
        a.account_type as "accountType",
        COALESCE(SUM(CASE WHEN t.type = 'DEBIT' THEN t.amount ELSE 0 END), 0)::float as "totalDebit",
        COALESCE(SUM(CASE WHEN t.type = 'CREDIT' THEN t.amount ELSE 0 END), 0)::float as "totalCredit",
        COALESCE(SUM(CASE WHEN t.type = 'DEBIT' THEN t.amount ELSE -t.amount END), 0)::float as "balance"
      FROM accounts a
      LEFT JOIN transactions t ON t.account_id = a.id 
        AND t.status = 'POSTED' 
        AND t.deleted_at IS NULL
        ${dateFilter}
      WHERE a.tenant_id = ${tenantId}::uuid
        AND a.deleted_at IS NULL
        AND a.is_active = true
      GROUP BY a.id, a.account_name, a.gl_code, a.account_type
      ORDER BY a.gl_code ASC
    `;
  }
}
