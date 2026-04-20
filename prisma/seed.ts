<<<<<<< HEAD
import { PrismaClient, SubscriptionTier, AccountType, TransactionType } from '@prisma/client';

/**
 * Prisma seed script — populates the database with demo data for development/testing.
 * Idempotent: uses upsert to avoid duplicates on re-run.
 *
 * Run with: npx prisma db seed
 */
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── 1. Create Demo Tenant ──────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      domain: 'acme.amdox.dev',
      subscriptionTier: SubscriptionTier.ENTERPRISE,
      settings: {
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        currency: 'USD',
        fiscalYearStart: '01-01',
      },
    },
  });
  console.log(`  ✅ Tenant: ${tenant.name} (${tenant.id})`);

  // ── 2. Create Roles ────────────────────────────────────────
  const roles = [
    {
      name: 'admin',
      description: 'Full tenant administration',
      permissions: ['*:*'],
      isSystem: true,
    },
    {
      name: 'accountant',
      description: 'Accounting module access',
      permissions: [
        'accounts:read', 'accounts:write',
        'transactions:read', 'transactions:write',
        'journal:read', 'journal:write', 'journal:post',
        'reports:read',
      ],
      isSystem: true,
    },
    {
      name: 'hr_manager',
      description: 'HR module access',
      permissions: [
        'employees:read', 'employees:write',
        'employees:delete',
        'reports:read',
      ],
      isSystem: true,
    },
    {
      name: 'inventory_manager',
      description: 'Inventory and procurement access',
      permissions: [
        'inventory:read', 'inventory:write',
        'purchase_orders:read', 'purchase_orders:write',
        'purchase_orders:approve',
      ],
      isSystem: true,
    },
    {
      name: 'auditor',
      description: 'Read-only audit access',
      permissions: [
        'accounts:read', 'transactions:read',
        'journal:read', 'audit_logs:read',
        'reports:read', 'employees:read',
      ],
      isSystem: true,
    },
    {
      name: 'viewer',
      description: 'Basic read-only access',
      permissions: [
        'accounts:read', 'transactions:read',
        'reports:read',
      ],
      isSystem: true,
    },
  ];

  const createdRoles: Record<string, any> = {};
  for (const role of roles) {
    createdRoles[role.name] = await prisma.role.upsert({
      where: {
        name_tenantId: { name: role.name, tenantId: tenant.id },
      },
      update: { permissions: role.permissions },
      create: {
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
        tenantId: tenant.id,
      },
    });
    console.log(`  ✅ Role: ${role.name}`);
  }

  // ── 3. Create Admin User ──────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: {
      email_tenantId: { email: 'admin@acme.com', tenantId: tenant.id },
    },
    update: {},
    create: {
      email: 'admin@acme.com',
      keycloakId: 'seed-admin-keycloak-id',
      firstName: 'System',
      lastName: 'Administrator',
      tenantId: tenant.id,
      isActive: true,
    },
  });
  console.log(`  ✅ Admin User: ${adminUser.email} (${adminUser.id})`);

  // Assign admin role
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: createdRoles['admin'].id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: createdRoles['admin'].id,
    },
  });

  // ── 4. Create Chart of Accounts ───────────────────────────
  const accountsData = [
    // Assets
    { accountName: 'Cash and Cash Equivalents', glCode: '1000', type: AccountType.ASSET },
    { accountName: 'Accounts Receivable', glCode: '1100', type: AccountType.ASSET },
    { accountName: 'Inventory', glCode: '1200', type: AccountType.ASSET },
    { accountName: 'Prepaid Expenses', glCode: '1300', type: AccountType.ASSET },
    { accountName: 'Fixed Assets', glCode: '1500', type: AccountType.ASSET },
    { accountName: 'Accumulated Depreciation', glCode: '1600', type: AccountType.ASSET },

    // Liabilities
    { accountName: 'Accounts Payable', glCode: '2000', type: AccountType.LIABILITY },
    { accountName: 'Accrued Liabilities', glCode: '2100', type: AccountType.LIABILITY },
    { accountName: 'Short-term Loans', glCode: '2200', type: AccountType.LIABILITY },
    { accountName: 'Long-term Debt', glCode: '2500', type: AccountType.LIABILITY },

    // Equity
    { accountName: 'Common Stock', glCode: '3000', type: AccountType.EQUITY },
    { accountName: 'Retained Earnings', glCode: '3100', type: AccountType.EQUITY },

    // Revenue
    { accountName: 'Sales Revenue', glCode: '4000', type: AccountType.REVENUE },
    { accountName: 'Service Revenue', glCode: '4100', type: AccountType.REVENUE },
    { accountName: 'Other Income', glCode: '4900', type: AccountType.REVENUE },

    // Expenses
    { accountName: 'Cost of Goods Sold', glCode: '5000', type: AccountType.EXPENSE },
    { accountName: 'Salaries and Wages', glCode: '6000', type: AccountType.EXPENSE },
    { accountName: 'Rent Expense', glCode: '6100', type: AccountType.EXPENSE },
    { accountName: 'Utilities Expense', glCode: '6200', type: AccountType.EXPENSE },
    { accountName: 'Office Supplies', glCode: '6300', type: AccountType.EXPENSE },
    { accountName: 'Depreciation Expense', glCode: '6400', type: AccountType.EXPENSE },
    { accountName: 'Insurance Expense', glCode: '6500', type: AccountType.EXPENSE },
  ];

  const createdAccounts: Record<string, any> = {};
  for (const account of accountsData) {
    createdAccounts[account.glCode] = await prisma.account.upsert({
      where: {
        glCode_tenantId: { glCode: account.glCode, tenantId: tenant.id },
      },
      update: {},
      create: {
        ...account,
        currency: 'USD',
        tenantId: tenant.id,
      },
    });
  }
  console.log(`  ✅ Chart of Accounts: ${accountsData.length} accounts created`);

  // ── 5. Create Sample Journal Entry ────────────────────────
  const journalEntry = await prisma.journalEntry.upsert({
    where: {
      reference_tenantId: { reference: 'JE-2024-001', tenantId: tenant.id },
    },
    update: {},
    create: {
      reference: 'JE-2024-001',
      description: 'Initial capital contribution',
      status: 'POSTED',
      totalAmount: 100000,
      currency: 'USD',
      tenantId: tenant.id,
      postedAt: new Date(),
    },
  });

  // Create balanced transactions (debit = credit)
  await prisma.transaction.createMany({
    data: [
      {
        accountId: createdAccounts['1000'].id,
        amount: 100000,
        type: TransactionType.DEBIT,
        currency: 'USD',
        description: 'Cash received from capital contribution',
        journalEntryId: journalEntry.id,
        postedAt: new Date(),
      },
      {
        accountId: createdAccounts['3000'].id,
        amount: 100000,
        type: TransactionType.CREDIT,
        currency: 'USD',
        description: 'Common stock issued',
        journalEntryId: journalEntry.id,
        postedAt: new Date(),
      },
    ],
    skipDuplicates: true,
  });
  console.log(`  ✅ Journal Entry: ${journalEntry.reference}`);

  // ── 6. Create Sample Employee ─────────────────────────────
  await prisma.employee.upsert({
    where: {
      employeeNumber_tenantId: { employeeNumber: 'EMP-001', tenantId: tenant.id },
    },
    update: {},
    create: {
      employeeNumber: 'EMP-001',
      personalInfo: {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-15',
        phone: '+1-555-0100',
        address: '123 Main St, New York, NY 10001',
      },
      contract: {
        type: 'FULL_TIME',
        startDate: '2024-01-15',
        probationEndDate: '2024-04-15',
        noticePeriodDays: 30,
      },
      position: 'Senior Accountant',
      department: 'Finance',
      employmentStatus: 'ACTIVE',
      hireDate: new Date('2024-01-15'),
      salary: 85000,
      currency: 'USD',
      tenantId: tenant.id,
      userId: adminUser.id,
    },
  });
  console.log(`  ✅ Employee: EMP-001 (Jane Doe)`);

  // ── 7. Create Sample Inventory Items ──────────────────────
  const inventoryItems = [
    {
      sku: 'WDG-001',
      name: 'Premium Widget',
      category: 'Widgets',
      currentStock: 500,
      reorderLevel: 100,
      reorderQty: 200,
      unitPrice: 29.99,
    },
    {
      sku: 'GDG-001',
      name: 'Standard Gadget',
      category: 'Gadgets',
      currentStock: 250,
      reorderLevel: 50,
      reorderQty: 100,
      unitPrice: 49.99,
    },
    {
      sku: 'SPR-001',
      name: 'Replacement Sprocket',
      category: 'Parts',
      currentStock: 1000,
      reorderLevel: 200,
      reorderQty: 500,
      unitPrice: 5.99,
    },
  ];

  for (const item of inventoryItems) {
    await prisma.inventoryItem.upsert({
      where: {
        sku_tenantId: { sku: item.sku, tenantId: tenant.id },
      },
      update: {},
      create: {
        ...item,
        currency: 'USD',
        tenantId: tenant.id,
      },
    });
  }
  console.log(`  ✅ Inventory Items: ${inventoryItems.length} items created`);

  // ── 8. Create Sample Purchase Order ───────────────────────
  await prisma.purchaseOrder.upsert({
    where: {
      poNumber_tenantId: { poNumber: 'PO-2024-001', tenantId: tenant.id },
    },
    update: {},
    create: {
      poNumber: 'PO-2024-001',
      vendorId: 'vendor-001',
      vendorName: 'Global Supplies Inc.',
      status: 'APPROVED',
      items: [
        { sku: 'WDG-001', name: 'Premium Widget', quantity: 200, unitPrice: 22.00, total: 4400.00 },
        { sku: 'SPR-001', name: 'Replacement Sprocket', quantity: 500, unitPrice: 3.50, total: 1750.00 },
      ],
      subtotal: 6150.00,
      taxAmount: 492.00,
      totalAmount: 6642.00,
      currency: 'USD',
      expectedDate: new Date('2024-03-01'),
      tenantId: tenant.id,
    },
  });
  console.log(`  ✅ Purchase Order: PO-2024-001`);

  console.log('\n🎉 Database seeding completed successfully!');
}

main()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
=======
import { PrismaClient, SubscriptionTier, AccountType, AccountSubType, Currency, TransactionType, EmploymentStatus, ContractType, NotificationType, NotificationChannel, AuditAction } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding AMDOX database...\n');

  // ── Tenants ───────────────────────────────────────────────
  console.log('📁 Creating tenants...');
  const platformTenant = await prisma.tenant.upsert({
    where: { slug: 'platform' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'AMDOX Platform',
      slug: 'platform',
      subscriptionTier: SubscriptionTier.ENTERPRISE,
      status: 'ACTIVE',
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
      status: 'ACTIVE',
      domain: 'demo.amdox.com',
      maxUsers: 50,
      settings: { industry: 'Technology', timezone: 'America/New_York' },
    },
  });

  const testTenant = await prisma.tenant.upsert({
    where: { slug: 'test-company' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Test Company Ltd',
      slug: 'test-company',
      subscriptionTier: SubscriptionTier.STARTER,
      status: 'ACTIVE',
      maxUsers: 10,
    },
  });

  console.log(`  ✅ Created ${3} tenants\n`);

  // ── Roles ─────────────────────────────────────────────────
  console.log('🔑 Creating roles...');
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name_tenantId: { name: 'super_admin', tenantId: platformTenant.id } },
      update: {},
      create: {
        name: 'super_admin',
        displayName: 'Super Administrator',
        description: 'Full platform access',
        permissions: ['*'],
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
    prisma.role.upsert({
      where: { name_tenantId: { name: 'hr_manager', tenantId: demoTenant.id } },
      update: {},
      create: {
        name: 'hr_manager',
        displayName: 'HR Manager',
        description: 'HR module access',
        permissions: ['hr:read', 'hr:write', 'hr:approve'],
        tenantId: demoTenant.id,
      },
    }),
    prisma.role.upsert({
      where: { name_tenantId: { name: 'viewer', tenantId: demoTenant.id } },
      update: {},
      create: {
        name: 'viewer',
        displayName: 'Viewer',
        description: 'Read-only access',
        permissions: ['finance:read', 'hr:read', 'inventory:read', 'procurement:read'],
        tenantId: demoTenant.id,
      },
    }),
  ]);

  console.log(`  ✅ Created ${roles.length} roles\n`);

  // ── Users ─────────────────────────────────────────────────
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

  const demoAccountant = await prisma.user.upsert({
    where: { email_tenantId: { email: 'accountant@demo.amdox.com', tenantId: demoTenant.id } },
    update: {},
    create: {
      email: 'accountant@demo.amdox.com',
      firstName: 'Jane',
      lastName: 'Finance',
      tenantId: demoTenant.id,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  // Assign roles
  await prisma.userRole.createMany({
    data: [
      { userId: adminUser.id, roleId: roles[0].id },
      { userId: demoAdmin.id, roleId: roles[1].id },
      { userId: demoAccountant.id, roleId: roles[2].id },
    ],
    skipDuplicates: true,
  });

  console.log(`  ✅ Created 3 users with role assignments\n`);

  // ── Chart of Accounts ─────────────────────────────────────
  console.log('📊 Creating chart of accounts...');
  const accounts = await Promise.all([
    // Assets
    prisma.account.create({
      data: {
        accountName: 'Cash and Cash Equivalents',
        glCode: '1000',
        accountType: AccountType.ASSET,
        accountSubType: AccountSubType.CURRENT_ASSET,
        currency: Currency.USD,
        tenantId: demoTenant.id,
        openingBalance: 100000,
        currentBalance: 100000,
      },
    }),
    prisma.account.create({
      data: {
        accountName: 'Accounts Receivable',
        glCode: '1100',
        accountType: AccountType.ASSET,
        accountSubType: AccountSubType.CURRENT_ASSET,
        currency: Currency.USD,
        tenantId: demoTenant.id,
        openingBalance: 25000,
        currentBalance: 25000,
      },
    }),
    prisma.account.create({
      data: {
        accountName: 'Office Equipment',
        glCode: '1500',
        accountType: AccountType.ASSET,
        accountSubType: AccountSubType.FIXED_ASSET,
        currency: Currency.USD,
        tenantId: demoTenant.id,
        openingBalance: 50000,
        currentBalance: 50000,
      },
    }),
    // Liabilities
    prisma.account.create({
      data: {
        accountName: 'Accounts Payable',
        glCode: '2000',
        accountType: AccountType.LIABILITY,
        accountSubType: AccountSubType.CURRENT_LIABILITY,
        currency: Currency.USD,
        tenantId: demoTenant.id,
        openingBalance: 15000,
        currentBalance: 15000,
      },
    }),
    // Equity
    prisma.account.create({
      data: {
        accountName: 'Retained Earnings',
        glCode: '3000',
        accountType: AccountType.EQUITY,
        accountSubType: AccountSubType.RETAINED_EARNINGS,
        currency: Currency.USD,
        tenantId: demoTenant.id,
        openingBalance: 160000,
        currentBalance: 160000,
      },
    }),
    // Revenue
    prisma.account.create({
      data: {
        accountName: 'Sales Revenue',
        glCode: '4000',
        accountType: AccountType.REVENUE,
        accountSubType: AccountSubType.OPERATING_REVENUE,
        currency: Currency.USD,
        tenantId: demoTenant.id,
      },
    }),
    // Expenses
    prisma.account.create({
      data: {
        accountName: 'Salaries Expense',
        glCode: '5000',
        accountType: AccountType.EXPENSE,
        accountSubType: AccountSubType.OPERATING_EXPENSE,
        currency: Currency.USD,
        tenantId: demoTenant.id,
      },
    }),
    prisma.account.create({
      data: {
        accountName: 'Rent Expense',
        glCode: '5100',
        accountType: AccountType.EXPENSE,
        accountSubType: AccountSubType.OPERATING_EXPENSE,
        currency: Currency.USD,
        tenantId: demoTenant.id,
      },
    }),
  ]);

  console.log(`  ✅ Created ${accounts.length} accounts\n`);

  // ── Journal Entry + Transactions ──────────────────────────
  console.log('💰 Creating sample journal entries...');
  const journalEntry = await prisma.journalEntry.create({
    data: {
      reference: 'JE-2024-001',
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
        status: 'POSTED',
        description: 'Monthly salary - Jan 2024',
        reference: 'JE-2024-001',
        postingDate: new Date('2024-01-31'),
        accountId: accounts[6].id, // Salaries Expense
        journalEntryId: journalEntry.id,
      },
      {
        amount: 8000,
        type: TransactionType.CREDIT,
        status: 'POSTED',
        description: 'Monthly salary - Jan 2024',
        reference: 'JE-2024-001',
        postingDate: new Date('2024-01-31'),
        accountId: accounts[0].id, // Cash
        journalEntryId: journalEntry.id,
      },
    ],
  });

  console.log(`  ✅ Created 1 journal entry with 2 transactions\n`);

  // ── Employees ─────────────────────────────────────────────
  console.log('🧑‍💼 Creating employees...');
  await prisma.employee.createMany({
    data: [
      {
        employeeCode: 'EMP-001',
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-05-15',
          gender: 'Male',
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
      {
        employeeCode: 'EMP-002',
        personalInfo: {
          firstName: 'Alice',
          lastName: 'Smith',
          dateOfBirth: '1988-11-22',
          gender: 'Female',
          phone: '+1-555-0102',
        },
        employmentStatus: EmploymentStatus.ACTIVE,
        contractType: ContractType.FULL_TIME,
        department: 'Finance',
        position: 'Senior Accountant',
        hireDate: new Date('2022-06-01'),
        salary: 85000,
        salaryCurrency: Currency.USD,
        tenantId: demoTenant.id,
      },
    ],
  });

  console.log(`  ✅ Created 2 employees\n`);

  // ── Vendors ───────────────────────────────────────────────
  console.log('🏢 Creating vendors...');
  const vendor = await prisma.vendor.create({
    data: {
      name: 'Office Supplies Inc.',
      code: 'VND-001',
      contactPerson: 'Bob Wilson',
      email: 'bob@officesupplies.com',
      phone: '+1-555-0200',
      paymentTerms: 'Net 30',
      currency: Currency.USD,
      rating: 4,
      tenantId: demoTenant.id,
    },
  });

  console.log(`  ✅ Created 1 vendor\n`);

  // ── Purchase Orders ───────────────────────────────────────
  console.log('📋 Creating purchase orders...');
  await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-2024-001',
      status: 'APPROVED',
      items: [
        { description: 'Desk Chair', quantity: 10, unitPrice: 250, totalPrice: 2500 },
        { description: 'Monitor Stand', quantity: 10, unitPrice: 75, totalPrice: 750 },
      ],
      subtotal: 3250,
      taxAmount: 260,
      totalAmount: 3510,
      currency: Currency.USD,
      expectedDate: new Date('2024-03-15'),
      vendorId: vendor.id,
      tenantId: demoTenant.id,
    },
  });

  console.log(`  ✅ Created 1 purchase order\n`);

  // ── Inventory Items ───────────────────────────────────────
  console.log('📦 Creating inventory items...');
  await prisma.inventoryItem.createMany({
    data: [
      {
        sku: 'CHAIR-ERG-001',
        name: 'Ergonomic Office Chair',
        category: 'Furniture',
        currentStock: 25,
        reorderLevel: 5,
        reorderQuantity: 20,
        unitCost: 250,
        sellingPrice: 399,
        stockStatus: 'IN_STOCK',
        location: 'Warehouse A',
        barcode: '1234567890123',
        tenantId: demoTenant.id,
      },
      {
        sku: 'MON-27-001',
        name: '27" 4K Monitor',
        category: 'Electronics',
        currentStock: 3,
        reorderLevel: 5,
        reorderQuantity: 10,
        unitCost: 350,
        sellingPrice: 499,
        stockStatus: 'LOW_STOCK',
        location: 'Warehouse B',
        barcode: '1234567890456',
        tenantId: demoTenant.id,
      },
    ],
  });

  console.log(`  ✅ Created 2 inventory items\n`);

  // ── Notifications ─────────────────────────────────────────
  console.log('🔔 Creating notifications...');
  await prisma.notification.createMany({
    data: [
      {
        title: 'Welcome to AMDOX',
        message: 'Your account has been set up successfully. Start exploring the platform!',
        type: NotificationType.SUCCESS,
        channel: NotificationChannel.IN_APP,
        status: 'DELIVERED',
        userId: demoAdmin.id,
      },
      {
        title: 'Low Stock Alert',
        message: '27" 4K Monitor (MON-27-001) is below reorder level. Current stock: 3',
        type: NotificationType.WARNING,
        channel: NotificationChannel.IN_APP,
        status: 'PENDING',
        userId: demoAdmin.id,
      },
    ],
  });

  console.log(`  ✅ Created 2 notifications\n`);

  // ── Audit Logs ────────────────────────────────────────────
  console.log('📝 Creating audit log entries...');
  await prisma.auditLog.createMany({
    data: [
      {
        entityType: 'Tenant',
        entityId: demoTenant.id,
        action: AuditAction.CREATE,
        newValue: { name: demoTenant.name, tier: demoTenant.subscriptionTier },
        changedFields: ['name', 'slug', 'subscriptionTier'],
        userId: adminUser.id,
        tenantId: demoTenant.id,
      },
      {
        entityType: 'User',
        entityId: demoAdmin.id,
        action: AuditAction.CREATE,
        newValue: { email: 'admin@demo.amdox.com' },
        changedFields: ['email', 'firstName', 'lastName'],
        userId: adminUser.id,
        tenantId: demoTenant.id,
      },
      {
        entityType: 'JournalEntry',
        entityId: journalEntry.id,
        action: AuditAction.APPROVE,
        oldValue: { status: 'DRAFT' },
        newValue: { status: 'POSTED' },
        changedFields: ['status'],
        userId: demoAccountant.id,
        tenantId: demoTenant.id,
      },
    ],
  });

  console.log(`  ✅ Created 3 audit log entries\n`);

  console.log('════════════════════════════════════════');
  console.log('🎉 Database seeding complete!');
  console.log('════════════════════════════════════════');
  console.log(`  Tenants:          3`);
  console.log(`  Roles:            ${roles.length}`);
  console.log(`  Users:            3`);
  console.log(`  Accounts:         ${accounts.length}`);
  console.log(`  Journal Entries:  1`);
  console.log(`  Transactions:     2`);
  console.log(`  Employees:        2`);
  console.log(`  Vendors:          1`);
  console.log(`  Purchase Orders:  1`);
  console.log(`  Inventory Items:  2`);
  console.log(`  Notifications:    2`);
  console.log(`  Audit Logs:       3`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
  });
