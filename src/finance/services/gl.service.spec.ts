import { Test, TestingModule } from '@nestjs/testing';
import { GLService } from './gl.service';
import { PrismaService } from '../../database/prisma.service';
import { AccountRepository } from '../../database/repositories/account.repository';
import { TransactionRepository } from '../../database/repositories/transaction.repository';
import { JournalEntryRepository } from '../../database/repositories/journal-entry.repository';
import { BadRequestException } from '@nestjs/common';
import { AccountType, TransactionType } from '@prisma/client';

describe('GLService', () => {
  let service: GLService;
  let prisma: PrismaService;

  const mockPrisma = {
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrisma)),
    journalEntry: {
      create: jest.fn().mockResolvedValue({ id: 'je-1' }),
    },
    transaction: {
      create: jest.fn().mockResolvedValue({ id: 'tx-1' }),
    },
    account: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 'acc-asset') return { id: 'acc-asset', type: AccountType.ASSET };
        if (where.id === 'acc-equity') return { id: 'acc-equity', type: AccountType.EQUITY };
        return null;
      }),
      update: jest.fn().mockResolvedValue({}),
    },
  };

  const mockAccountRepo = {
    findAll: jest.fn(),
    findByCode: jest.fn(),
    create: jest.fn(),
    getTrialBalance: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GLService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AccountRepository, useValue: mockAccountRepo },
        { provide: TransactionRepository, useValue: {} },
        { provide: JournalEntryRepository, useValue: {} },
      ],
    }).compile();

    service = module.get<GLService>(GLService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createJournalEntry', () => {
    it('should throw BadRequestException if debits do not equal credits', async () => {
      const dto = {
        reference: 'JE-1',
        description: 'Unbalanced',
        entryDate: '2024-01-01',
        lines: [
          { accountId: 'acc-1', amount: 100, type: TransactionType.DEBIT },
          { accountId: 'acc-2', amount: 50, type: TransactionType.CREDIT },
        ],
      };

      await expect(service.createJournalEntry(dto, 'tenant-1')).rejects.toThrow(BadRequestException);
    });

    it('should post balanced journal entry and update balances', async () => {
      const dto = {
        reference: 'JE-2',
        description: 'Balanced',
        entryDate: '2024-01-01',
        lines: [
          { accountId: 'acc-asset', amount: 1000, type: TransactionType.DEBIT },
          { accountId: 'acc-equity', amount: 1000, type: TransactionType.CREDIT },
        ],
      };

      const result = await service.createJournalEntry(dto, 'tenant-1');

      expect(result).toBeDefined();
      expect(mockPrisma.journalEntry.create).toHaveBeenCalled();
      expect(mockPrisma.transaction.create).toHaveBeenCalledTimes(2);
      
      // Asset increased with Debit
      expect(mockPrisma.account.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'acc-asset' },
        data: { balance: { increment: 1000 } },
      }));

      // Equity increased with Credit
      expect(mockPrisma.account.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'acc-equity' },
        data: { balance: { increment: 1000 } },
      }));
    });
  });
});
