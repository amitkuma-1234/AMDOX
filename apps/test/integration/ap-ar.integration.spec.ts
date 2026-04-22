import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { ApService } from '@ap-ar/services/ap.service';
import { ArService } from '@ap-ar/services/ar.service';
import { GLService } from '@finance/services/gl.service';
import { ApArModule } from '@ap-ar/ap-ar.module';
import { FinanceModule } from '@finance/finance.module';
import { DatabaseModule } from '@database/database.module';
const AccountType = { ASSET: 'ASSET' as any, LIABILITY: 'LIABILITY' as any, EQUITY: 'EQUITY' as any, REVENUE: 'REVENUE' as any, EXPENSE: 'EXPENSE' as any };
import { ConfigModule } from '@nestjs/config';

describe('AP/AR Integration Tests', () => {
  let app: INestApplication;
  let apService: ApService;
  let arService: ArService;
  let glService: GLService;
  let prisma: PrismaService;
  let tenantId = 'integration-tenant-apar';
  let vendorId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        FinanceModule,
        ApArModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    apService = moduleFixture.get<ApService>(ApService);
    arService = moduleFixture.get<ArService>(ArService);
    glService = moduleFixture.get<GLService>(GLService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Setup tenant and base data for testing
    await prisma.tenant.upsert({
      where: { id: tenantId },
      update: {},
      create: { id: tenantId, name: 'AP/AR Integration Test Tenant' },
    });

    // Create a Vendor
    const vendor = await prisma.vendor.create({
      data: {
        code: 'VEND-001',
        name: 'Test Supplier Inc',
        tenantId,
      }
    });
    vendorId = vendor.id;

    // Create Default GL Accounts needed for AP/AR
    await glService.createAccount({ accountName: 'Accounts Payable', glCode: '2000', type: AccountType.LIABILITY, openingBalance: 0 }, tenantId);
    await glService.createAccount({ accountName: 'General Expense', glCode: '5000', type: AccountType.EXPENSE, openingBalance: 0 }, tenantId);
    await glService.createAccount({ accountName: 'Accounts Receivable', glCode: '1100', type: AccountType.ASSET, openingBalance: 0 }, tenantId);
    await glService.createAccount({ accountName: 'Sales Revenue', glCode: '4000', type: AccountType.REVENUE, openingBalance: 0 }, tenantId);
  });

  afterAll(async () => {
    // Cleanup
    await prisma.transaction.deleteMany({ where: { account: { tenantId } } });
    await prisma.journalEntry.deleteMany({ where: { tenantId } });
    await prisma.apInvoice.deleteMany({ where: { tenantId } });
    await prisma.arInvoice.deleteMany({ where: { tenantId } });
    await prisma.vendor.deleteMany({ where: { tenantId } });
    await prisma.account.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    
    await app.close();
  });

  it('should create an AP Invoice and auto-post to GL', async () => {
    const invoice = await apService.createInvoice({
      invoiceNumber: 'INV-AP-101',
      vendorId,
      totalAmount: 1500.00,
      taxAmount: 0,
      invoiceDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      currency: 'USD'
    }, tenantId);

    expect(invoice.id).toBeDefined();
    expect(invoice.status).toBe('APPROVED');

    // Verify GL impact (Expense up by 1500, AP up by 1500)
    const expenseAccount = await prisma.account.findFirst({ where: { tenantId, glCode: '5000' } });
    const apAccount = await prisma.account.findFirst({ where: { tenantId, glCode: '2000' } });

    expect(expenseAccount?.balance.toNumber()).toBe(1500);
    expect(apAccount?.balance.toNumber()).toBe(1500); // Liability increases with credit
  });

  it('should create an AR Invoice and auto-post to GL', async () => {
    const invoice = await arService.createInvoice({
      invoiceNumber: 'INV-AR-201',
      customerName: 'Acme Corp',
      totalAmount: 3000.00,
      invoiceDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      currency: 'USD'
    }, tenantId);

    expect(invoice.id).toBeDefined();

    // Verify GL impact (AR up by 3000, Revenue up by 3000)
    const arAccount = await prisma.account.findFirst({ where: { tenantId, glCode: '1100' } });
    const revenueAccount = await prisma.account.findFirst({ where: { tenantId, glCode: '4000' } });

    // Assuming existing balances from previous test won't conflict because they use different accounts
    expect(arAccount?.balance.toNumber()).toBe(3000);
    expect(revenueAccount?.balance.toNumber()).toBe(3000); // Revenue increases with credit
  });
});
