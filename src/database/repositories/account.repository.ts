import { Injectable } from '@nestjs/common';
import { Account, AccountType, Prisma, Currency } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

/**
 * Repository for Account entities with multi-currency and GL code support.
 */
@Injectable()
export class AccountRepository extends BaseRepository<Account> {
  protected readonly modelName = 'Account';

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate() {
    return this.prisma.account;
  }

  /**
   * Find account by GL code within a tenant.
   */
  async findByGlCode(glCode: string, tenantId: string): Promise<Account | null> {
    return this.prisma.account.findFirst({
      where: { glCode, tenantId },
      include: { children: true },
    });
  }

  /**
   * List accounts by type within a tenant.
   */
  async findByType(type: AccountType, tenantId: string): Promise<Account[]> {
    return this.prisma.account.findMany({
      where: { type, tenantId, isActive: true },
      orderBy: { glCode: 'asc' },
    });
  }

  /**
   * Get chart of accounts tree (parent-child hierarchy).
   */
  async getChartOfAccounts(tenantId: string) {
    return this.prisma.account.findMany({
      where: { tenantId, parentId: null, isActive: true },
      include: {
        children: {
          where: { isActive: true },
          include: {
            children: {
              where: { isActive: true },
            },
          },
          orderBy: { glCode: 'asc' },
        },
      },
      orderBy: { glCode: 'asc' },
    });
  }

  /**
   * Get account balance aggregation by currency for a tenant.
   */
  async getBalancesByCurrency(tenantId: string) {
    const result = await this.prisma.account.groupBy({
      by: ['type', 'currency'],
      where: { tenantId, isActive: true },
      _sum: { balance: true },
      _count: { id: true },
    });

    return result.map((group) => ({
      type: group.type,
      currency: group.currency,
      totalBalance: group._sum.balance || new Prisma.Decimal(0),
      accountCount: group._count.id,
    }));
  }

  /**
   * Get trial balance — debit and credit totals per account type.
   */
  async getTrialBalance(tenantId: string, currency: Currency = Currency.USD) {
    const accounts = await this.prisma.account.findMany({
      where: { tenantId, currency, isActive: true },
      include: {
        transactions: {
          where: { deletedAt: null },
          select: { type: true, amount: true },
        },
      },
    });

    return accounts.map((account) => {
      const transactions = (account as any).transactions || [];
      const debits = transactions
        .filter((t: any) => t.type === 'DEBIT')
        .reduce((sum: Prisma.Decimal, t: any) => sum.add(t.amount), new Prisma.Decimal(0));
      const credits = transactions
        .filter((t: any) => t.type === 'CREDIT')
        .reduce((sum: Prisma.Decimal, t: any) => sum.add(t.amount), new Prisma.Decimal(0));

      return {
        id: account.id,
        accountName: account.accountName,
        glCode: account.glCode,
        type: account.type,
        debitTotal: debits,
        creditTotal: credits,
        balance: account.balance,
      };
    });
  }

  /**
   * Search accounts by name or GL code.
   */
  async search(query: string, tenantId: string) {
    return this.prisma.account.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { accountName: { contains: query, mode: 'insensitive' } },
          { glCode: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { glCode: 'asc' },
      take: 50,
    });
  }
}
