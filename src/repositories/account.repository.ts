import { Injectable } from '@nestjs/common';
import { Account, Prisma, Currency } from '@prisma/client';
import { BaseRepository, PaginatedResult, BaseQueryOptions } from '../database/base.repository';
import { PrismaService } from '../database/prisma.service';

/**
 * AccountRepository provides specialized data access for the Chart of Accounts.
 * Supports multi-currency, hierarchical accounts, and GL code lookups.
 */
@Injectable()
export class AccountRepository extends BaseRepository<Account> {
  constructor(prisma: PrismaService) {
    super(prisma, 'Account');
  }

  protected getDelegate() {
    return this.prisma.account;
  }

  /**
   * Find account by GL code within a tenant.
   */
  async findByGlCode(
    tenantId: string,
    glCode: string,
  ): Promise<Account | null> {
    return this.prisma.account.findFirst({
      where: {
        tenantId,
        glCode,
        deletedAt: null,
      },
      include: {
        children: true,
      },
    });
  }

  /**
   * Get the full chart of accounts tree for a tenant.
   */
  async getChartOfAccounts(tenantId: string): Promise<Account[]> {
    return this.prisma.account.findMany({
      where: {
        tenantId,
        parentId: null, // Root-level accounts
        deletedAt: null,
      },
      include: {
        children: {
          where: { deletedAt: null },
          include: {
            children: {
              where: { deletedAt: null },
              orderBy: { glCode: 'asc' },
            },
          },
          orderBy: { glCode: 'asc' },
        },
      },
      orderBy: { glCode: 'asc' },
    });
  }

  /**
   * Find accounts by type (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE).
   */
  async findByType(
    tenantId: string,
    accountType: string,
    options: BaseQueryOptions = {},
  ): Promise<PaginatedResult<Account>> {
    return this.findWhere(tenantId, { accountType }, options);
  }

  /**
   * Find accounts by currency.
   */
  async findByCurrency(
    tenantId: string,
    currency: Currency,
  ): Promise<Account[]> {
    return this.prisma.account.findMany({
      where: {
        tenantId,
        currency,
        deletedAt: null,
      },
      orderBy: { glCode: 'asc' },
    });
  }

  /**
   * Get account balance summary by type.
   */
  async getBalanceSummary(
    tenantId: string,
  ): Promise<Array<{ accountType: string; totalBalance: number; count: number }>> {
    const result = await this.prisma.account.groupBy({
      by: ['accountType'],
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
      },
      _sum: {
        currentBalance: true,
      },
      _count: {
        id: true,
      },
    });

    return result.map((r) => ({
      accountType: r.accountType,
      totalBalance: Number(r._sum.currentBalance || 0),
      count: r._count.id,
    }));
  }

  /**
   * Update account balance after a transaction.
   */
  async updateBalance(
    accountId: string,
    amount: number,
    type: 'DEBIT' | 'CREDIT',
  ): Promise<Account> {
    // For ASSET and EXPENSE accounts: DEBIT increases, CREDIT decreases
    // For LIABILITY, EQUITY, REVENUE: CREDIT increases, DEBIT decreases
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    const normalDebitTypes = ['ASSET', 'EXPENSE'];
    const isNormalDebit = normalDebitTypes.includes(account.accountType);

    let adjustedAmount: number;
    if (isNormalDebit) {
      adjustedAmount = type === 'DEBIT' ? amount : -amount;
    } else {
      adjustedAmount = type === 'CREDIT' ? amount : -amount;
    }

    return this.prisma.account.update({
      where: { id: accountId },
      data: {
        currentBalance: {
          increment: adjustedAmount,
        },
      },
    });
  }

  /**
   * Search accounts by name or GL code.
   */
  async search(
    tenantId: string,
    query: string,
    options: BaseQueryOptions = {},
  ): Promise<PaginatedResult<Account>> {
    const { page = 1, pageSize = 20 } = options;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AccountWhereInput = {
      tenantId,
      deletedAt: null,
      OR: [
        { accountName: { contains: query, mode: 'insensitive' } },
        { glCode: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    };

    const [data, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { glCode: 'asc' },
      }),
      this.prisma.account.count({ where }),
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
}
