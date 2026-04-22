import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { AccountRepository } from '../../database/repositories/account.repository';
import { TransactionRepository } from '../../database/repositories/transaction.repository';
import { JournalEntryRepository } from '../../database/repositories/journal-entry.repository';
import { PrismaService } from '../../database/prisma.service';
import { CreateAccountDto, CreateJournalEntryDto } from '../dto/gl.dto';
import { TransactionStatus, TransactionType, Currency } from '@prisma/client';

@Injectable()
export class GLService {
  private readonly logger = new Logger(GLService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly journalEntryRepository: JournalEntryRepository,
  ) {}

  async getChartOfAccounts(tenantId: string, isActive?: boolean) {
    return this.accountRepository.getChartOfAccounts(tenantId); 
  }

  async createAccount(dto: CreateAccountDto, tenantId: string) {
    this.logger.log(`Creating account: ${dto.accountName} (${dto.glCode})`);
    
    const existing = await this.accountRepository.findByGlCode(dto.glCode, tenantId);
    if (existing) {
      throw new BadRequestException(`Account with GL code ${dto.glCode} already exists`);
    }

    return this.accountRepository.create({
      ...dto,
      tenantId,
      balance: dto.openingBalance || 0,
    } as any);
  }

  /**
   * Post a manual journal entry.
   * Validates that total debits equal total credits (Double Entry Principle).
   */
  async createJournalEntry(dto: CreateJournalEntryDto, tenantId: string) {
    this.logger.log(`Creating journal entry: ${dto.reference}`);

    // ── Step 1: Double Entry Validation ───────────────────────
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of dto.lines) {
      if (line.type === TransactionType.DEBIT) totalDebit += line.amount;
      else totalCredit += line.amount;
    }

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new BadRequestException(
        `Unbalanced journal entry: Total Debit (${totalDebit}) does not equal Total Credit (${totalCredit})`,
      );
    }

    // ── Step 2: Atomic Transaction ─────────────────────────────
    return this.prisma.$transaction(async (tx) => {
      // 1. Create Journal Entry
      const entry = await tx.journalEntry.create({
        data: {
          reference: dto.reference,
          description: dto.description,
          entryDate: new Date(dto.entryDate),
          postingDate: new Date(),
          status: 'POSTED',
          totalDebit,
          totalCredit,
          tenantId,
        },
      });

      // 2. Create Transactions and Update Account Balances
      for (const line of dto.lines) {
        await tx.transaction.create({
          data: {
            accountId: line.accountId,
            amount: line.amount,
            type: line.type,
            status: TransactionStatus.POSTED,
            description: line.description || dto.description,
            reference: dto.reference,
            postingDate: new Date(),
            journalEntryId: entry.id,
          },
        });

        const account = await tx.account.findUnique({ where: { id: line.accountId } });
        if (!account) throw new BadRequestException(`Account ${line.accountId} not found`);

        const isDebitIncrease = ['ASSET', 'EXPENSE'].includes(account.type);
        const balanceChange = (line.type === TransactionType.DEBIT) === isDebitIncrease
          ? line.amount
          : -line.amount;

        await tx.account.update({
          where: { id: line.accountId },
          data: { balance: { increment: balanceChange } },
        });
      }

      return entry;
    });
  }

  async getTrialBalance(tenantId: string, currency: Currency = Currency.USD) {
    return this.accountRepository.getTrialBalance(tenantId, currency);
  }
}
