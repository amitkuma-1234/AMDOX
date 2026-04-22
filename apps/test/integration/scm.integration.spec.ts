import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { SupplyChainService } from '@scm/services/supply-chain.service';
import { ScmModule } from '@scm/scm.module';
import { DatabaseModule } from '@database/database.module';
import { ConfigModule } from '@nestjs/config';

describe('SCM Integration Tests', () => {
  let app: INestApplication;
  let scmService: SupplyChainService;
  let prisma: PrismaService;
  let tenantId = 'integration-tenant-scm';
  let vendorId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        ScmModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    scmService = moduleFixture.get<SupplyChainService>(SupplyChainService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Setup tenant and base data for testing
    await prisma.tenant.upsert({
      where: { id: tenantId },
      update: {},
      create: { id: tenantId, name: 'SCM Integration Test Tenant' },
    });

    // Create a Vendor
    const vendor = await prisma.vendor.create({
      data: {
        code: 'VEND-SCM-001',
        name: 'SCM Test Supplier Inc',
        tenantId,
      }
    });
    vendorId = vendor.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.purchaseOrder.deleteMany({ where: { tenantId } });
    await prisma.inventoryItem.deleteMany({ where: { tenantId } });
    await prisma.vendor.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    
    await app.close();
  });

  it('should create a Purchase Order', async () => {
    // Create inventory items first
    const itemA = await prisma.inventoryItem.create({
      data: {
        sku: 'ITEM-A',
        name: 'Item A',
        unitCost: 15.50,
        tenantId,
      }
    });
    
    const itemB = await prisma.inventoryItem.create({
      data: {
        sku: 'ITEM-B',
        name: 'Item B',
        unitCost: 30.00,
        tenantId,
      }
    });

    const po = await scmService.createPurchaseOrder({
      orderNumber: 'PO-1001',
      vendorId,
      expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      items: [
        { inventoryItemId: itemA.id, quantity: 100, unitPrice: 15.50 },
        { inventoryItemId: itemB.id, quantity: 50, unitPrice: 30.00 }
      ]
    }, tenantId);

    expect(po.id).toBeDefined();
    expect(po.status).toBe('DRAFT');
    expect(po.totalAmount.toNumber()).toBe((100 * 15.50) + (50 * 30.00));
  });

  it('should retrieve purchase orders for a tenant', async () => {
    const pos = await prisma.purchaseOrder.findMany({ where: { tenantId } });
    expect(pos.length).toBeGreaterThan(0);
  });
});
