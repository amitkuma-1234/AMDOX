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
  });
