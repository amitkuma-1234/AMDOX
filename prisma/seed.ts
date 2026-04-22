import {
  PrismaClient,
  SubscriptionTier,
  AccountType,
  AccountSubType,
  Currency,
  TransactionType,
  EmploymentStatus,
  ContractType,
  NotificationType,
  NotificationChannel,
  AuditAction,
  TransactionStatus,
  PurchaseOrderStatus,
  StockStatus,
  TenantStatus
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding AMDOX database...\n');

  // ── 1. Tenants ──────────────────────────────────────────────
  console.log('📁 Creating tenants...');
  const platformTenant = await prisma.tenant.upsert({
    where: { slug: 'platform' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'AMDOX Platform',
      slug: 'platform',
      subscriptionTier: SubscriptionTier.ENTERPRISE,
      status: TenantStatus.ACTIVE,
      domain: 'amdox.com',
      maxUsers: 1000,
      settings: { isRootTenant: true },
    },
  });

  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'demo-corp' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Demo Corporation',
      slug: 'demo-corp',
      subscriptionTier: SubscriptionTier.PROFESSIONAL,
      status: TenantStatus.ACTIVE,
      domain: 'demo.amdox.com',
      maxUsers: 50,
      settings: { industry: 'Technology', timezone: 'America/New_York' },
    },
  });

  console.log(`  ✅ Created tenants\n`);

  // ── 2. Roles ────────────────────────────────────────────────
  console.log('🔑 Creating roles...');
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name_tenantId: { name: 'super_admin', tenantId: platformTenant.id } },
      update: {},
      create: {
        name: 'super_admin',
        displayName: 'Super Administrator',
        description: 'Full platform access',
        permissions: ['*:*'],
        isSystem: true,
        tenantId: platformTenant.id,
      },
    }),
    prisma.role.upsert({
      where: { name_tenantId: { name: 'tenant_admin', tenantId: demoTenant.id } },
      update: {},
      create: {
        name: 'tenant_admin',
        displayName: 'Tenant Administrator',
        description: 'Full tenant access',
        permissions: ['tenant:*', 'users:*', 'finance:*', 'hr:*', 'inventory:*', 'procurement:*'],
        isSystem: true,
        tenantId: demoTenant.id,
      },
    }),
    prisma.role.upsert({
      where: { name_tenantId: { name: 'accountant', tenantId: demoTenant.id } },
      update: {},
      create: {
        name: 'accountant',
        displayName: 'Accountant',
        description: 'Finance module access',
        permissions: ['finance:read', 'finance:write', 'finance:approve'],
        tenantId: demoTenant.id,
      },
    }),
  ]);

  console.log(`  ✅ Created ${roles.length} roles\n`);

  // ── 3. Users ────────────────────────────────────────────────
  console.log('👤 Creating users...');
  const adminUser = await prisma.user.upsert({
    where: { email_tenantId: { email: 'admin@amdox.com', tenantId: platformTenant.id } },
    update: {},
    create: {
      email: 'admin@amdox.com',
      firstName: 'Platform',
      lastName: 'Admin',
      keycloakId: 'platform-admin-kc-id',
      tenantId: platformTenant.id,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  const demoAdmin = await prisma.user.upsert({
    where: { email_tenantId: { email: 'admin@demo.amdox.com', tenantId: demoTenant.id } },
    update: {},
    create: {
      email: 'admin@demo.amdox.com',
      firstName: 'Demo',
      lastName: 'Admin',
      keycloakId: 'demo-admin-kc-id',
      tenantId: demoTenant.id,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  // Assign roles
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: roles[0].id } },
    update: {},
    create: { userId: adminUser.id, roleId: roles[0].id },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: demoAdmin.id, roleId: roles[1].id } },
    update: {},
    create: { userId: demoAdmin.id, roleId: roles[1].id },
  });

  console.log(`  ✅ Created users and assignments\n`);

  // ── 4. Chart of Accounts ────────────────────────────────────
  console.log('📊 Creating chart of accounts...');
  const accountDefinitions = [
    { name: 'Cash', code: '1000', type: AccountType.ASSET, sub: AccountSubType.CURRENT_ASSET, bal: 100000 },
    { name: 'Accounts Receivable', code: '1100', type: AccountType.ASSET, sub: AccountSubType.CURRENT_ASSET, bal: 25000 },
    { name: 'Accounts Payable', code: '2000', type: AccountType.LIABILITY, sub: AccountSubType.CURRENT_LIABILITY, bal: 15000 },
    { name: 'Retained Earnings', code: '3000', type: AccountType.EQUITY, sub: AccountSubType.RETAINED_EARNINGS, bal: 110000 },
    { name: 'Sales Revenue', code: '4000', type: AccountType.REVENUE, sub: AccountSubType.OPERATING_REVENUE, bal: 0 },
    { name: 'Salaries Expense', code: '5000', type: AccountType.EXPENSE, sub: AccountSubType.OPERATING_EXPENSE, bal: 0 },
  ];

  const createdAccounts: Record<string, any> = {};
  for (const acc of accountDefinitions) {
    createdAccounts[acc.code] = await prisma.account.upsert({
      where: { glCode_tenantId: { glCode: acc.code, tenantId: demoTenant.id } },
      update: {},
      create: {
        accountName: acc.name,
        glCode: acc.code,
        type: acc.type,
        subType: acc.sub,
        currency: Currency.USD,
        tenantId: demoTenant.id,
        openingBalance: acc.bal,
        balance: acc.bal,
      },
    });
  }

  console.log(`  ✅ Created ${accountDefinitions.length} accounts\n`);

  // ── 5. Journal Entry + Transactions ─────────────────────────
  console.log('💰 Creating sample journal entry...');
  const journalEntry = await prisma.journalEntry.upsert({
    where: { reference_tenantId: { reference: 'JE-2024-01', tenantId: demoTenant.id } },
    update: {},
    create: {
      reference: 'JE-2024-01',
      description: 'Monthly salary payment',
      status: 'POSTED',
      entryDate: new Date('2024-01-31'),
      postingDate: new Date('2024-01-31'),
      totalDebit: 8000,
      totalCredit: 8000,
      tenantId: demoTenant.id,
    },
  });

  await prisma.transaction.createMany({
    data: [
      {
        amount: 8000,
        type: TransactionType.DEBIT,
        status: TransactionStatus.POSTED,
        description: 'Monthly salary - Jan 2024',
        reference: 'JE-2024-01',
        postingDate: new Date('2024-01-31'),
        accountId: createdAccounts['5000'].id,
        journalEntryId: journalEntry.id,
      },
      {
        amount: 8000,
        type: TransactionType.CREDIT,
        status: TransactionStatus.POSTED,
        description: 'Monthly salary - Jan 2024',
        reference: 'JE-2024-01',
        postingDate: new Date('2024-01-31'),
        accountId: createdAccounts['1000'].id,
        journalEntryId: journalEntry.id,
      },
    ],
    skipDuplicates: true,
  });

  console.log(`  ✅ Created journal entry and transactions\n`);

  // ── 6. Employees ────────────────────────────────────────────
  console.log('🧑‍💼 Creating employees...');
  await prisma.employee.upsert({
    where: { employeeCode_tenantId: { employeeCode: 'EMP-001', tenantId: demoTenant.id } },
    update: {},
    create: {
      employeeCode: 'EMP-001',
      personalInfo: {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-05-15',
        phone: '+1-555-0101',
      },
      employmentStatus: EmploymentStatus.ACTIVE,
      contractType: ContractType.FULL_TIME,
      department: 'Engineering',
      position: 'Senior Developer',
      hireDate: new Date('2023-01-15'),
      salary: 95000,
      salaryCurrency: Currency.USD,
      tenantId: demoTenant.id,
    },
  });

  console.log(`  ✅ Created employees\n`);

  // ── 7. Vendors ──────────────────────────────────────────────
  console.log('🏢 Creating vendors...');
  const vendor = await prisma.vendor.upsert({
    where: { code_tenantId: { code: 'VND-001', tenantId: demoTenant.id } },
    update: {},
    create: {
      name: 'Office Supplies Inc.',
      code: 'VND-001',
      contactPerson: 'Bob Wilson',
      email: 'bob@officesupplies.com',
      paymentTerms: 'Net 30',
      currency: Currency.USD,
      tenantId: demoTenant.id,
    },
  });

  console.log(`  ✅ Created vendor\n`);

  // ── 8. Purchase Orders ──────────────────────────────────────
  console.log('📋 Creating purchase orders...');
  await prisma.purchaseOrder.upsert({
    where: { orderNumber_tenantId: { orderNumber: 'PO-2024-001', tenantId: demoTenant.id } },
    update: {},
    create: {
      orderNumber: 'PO-2024-001',
      status: PurchaseOrderStatus.APPROVED,
      items: [
        { description: 'Desk Chair', quantity: 10, unitPrice: 250, totalPrice: 2500 },
      ],
      subtotal: 2500,
      taxAmount: 200,
      totalAmount: 2700,
      currency: Currency.USD,
      expectedDate: new Date('2024-03-15'),
      vendorId: vendor.id,
      tenantId: demoTenant.id,
    },
  });

  console.log(`  ✅ Created purchase order\n`);

  // ── 9. Inventory Items ──────────────────────────────────────
  console.log('📦 Creating inventory items...');
  await prisma.inventoryItem.upsert({
    where: { sku_tenantId: { sku: 'CHAIR-01', tenantId: demoTenant.id } },
    update: {},
    create: {
      sku: 'CHAIR-01',
      name: 'Ergonomic Chair',
      category: 'Furniture',
      currentStock: 25,
      reorderLevel: 5,
      reorderQuantity: 20,
      unitCost: 200,
      sellingPrice: 350,
      stockStatus: StockStatus.IN_STOCK,
      tenantId: demoTenant.id,
    },
  });

  console.log(`  ✅ Created inventory items\n`);

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
