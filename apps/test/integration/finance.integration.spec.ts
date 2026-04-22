import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { GLService } from '@finance/services/gl.service';
import { FinanceModule } from '@finance/finance.module';
import { DatabaseModule } from '@database/database.module';
const AccountType = { ASSET: 'ASSET' as any, LIABILITY: 'LIABILITY' as any, EQUITY: 'EQUITY' as any, REVENUE: 'REVENUE' as any, EXPENSE: 'EXPENSE' as any };
const TransactionType = { DEBIT: 'DEBIT' as any, CREDIT: 'CREDIT' as any };
import { ConfigModule } from '@nestjs/config';

describe('Finance Integration Tests (GL)', () => {
  let app: INestApplication;
  let glService: GLService;
  let prisma: PrismaService;
  let tenantId = 'integration-tenant-finance';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        FinanceModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    glService = moduleFixture.get<GLService>(GLService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Setup tenant for testing
    await prisma.tenant.upsert({
      where: { id: tenantId },
      update: {},
      create: { id: tenantId, name: 'Finance Integration Test Tenant' },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.transaction.deleteMany({ where: { account: { tenantId } } });
    await prisma.journalEntry.deleteMany({ where: { tenantId } });
    await prisma.account.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    
    await app.close();
  });

  it('should create Chart of Accounts and post a Journal Entry', async () => {
    // 1. Create Accounts
    const assetAccount = await glService.createAccount({
      accountName: 'Cash',
      glCode: '1000',
      type: AccountType.ASSET,
      openingBalance: 0,
    }, tenantId);

    const equityAccount = await glService.createAccount({
      accountName: 'Owner Equity',
      glCode: '3000',
      type: AccountType.EQUITY,
      openingBalance: 0,
    }, tenantId);

    expect(assetAccount.id).toBeDefined();
    expect(equityAccount.id).toBeDefined();

    // 2. Post Initial Investment Journal Entry
    const je = await glService.createJournalEntry({
      reference: 'JE-001',
      description: 'Initial Investment',
      entryDate: new Date().toISOString(),
      lines: [
        { accountId: assetAccount.id, amount: 50000, type: TransactionType.DEBIT },
        { accountId: equityAccount.id, amount: 50000, type: TransactionType.CREDIT },
      ],
    }, tenantId);

    expect(je.id).toBeDefined();
    expect(je.totalDebit.toNumber()).toBe(50000);
    expect(je.totalCredit.toNumber()).toBe(50000);

    // 3. Verify Trial Balance
    const trialBalance = await glService.getTrialBalance(tenantId);
    
    expect(trialBalance.length).toBe(2);
    
    const cashBalance = trialBalance.find(a => a.id === assetAccount.id);
    const equityBalance = trialBalance.find(a => a.id === equityAccount.id);

    // Asset increases with Debit, Equity increases with Credit
    expect(cashBalance?.balance.toNumber()).toBe(50000);
    expect(equityBalance?.balance.toNumber()).toBe(50000);
    
    expect(cashBalance?.debitTotal.toNumber()).toBe(50000);
    expect(equityBalance?.creditTotal.toNumber()).toBe(50000);
  });
});
