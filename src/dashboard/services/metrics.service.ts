import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getFinancialMetrics(tenantId: string, startDate?: string, endDate?: string) {
    const accounts = await this.prisma.account.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
      select: { id: true, accountName: true, type: true, balance: true, currency: true },
    });

    const totalAssets = accounts.filter(a => a.type === 'ASSET').reduce((sum, a) => sum + Number(a.balance), 0);
    const totalLiabilities = accounts.filter(a => a.type === 'LIABILITY').reduce((sum, a) => sum + Number(a.balance), 0);
    const totalRevenue = accounts.filter(a => a.type === 'REVENUE').reduce((sum, a) => sum + Number(a.balance), 0);
    const totalExpenses = accounts.filter(a => a.type === 'EXPENSE').reduce((sum, a) => sum + Number(a.balance), 0);

    return {
      gl_balances: {
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        total_equity: totalAssets - totalLiabilities,
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
      },
      pl_summary: {
        net_income: totalRevenue - totalExpenses,
        gross_margin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
      },
      account_breakdown: accounts.map(a => ({
        name: a.accountName,
        type: a.type,
        balance: Number(a.balance),
      })),
    };
  }

  async getHrMetrics(tenantId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, deletedAt: null },
      select: { employmentStatus: true, contractType: true, department: true, salary: true },
    });

    const activeCount = employees.filter(e => e.employmentStatus === 'ACTIVE').length;
    const totalPayroll = employees.reduce((sum, e) => sum + Number(e.salary || 0), 0);
    const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

    const departmentBreakdown = departments.map(dept => ({
      department: dept,
      headcount: employees.filter(e => e.department === dept).length,
      payroll: employees.filter(e => e.department === dept).reduce((sum, e) => sum + Number(e.salary || 0), 0),
    }));

    return {
      headcount: {
        total: employees.length,
        active: activeCount,
        on_leave: employees.filter(e => e.employmentStatus === 'ON_LEAVE').length,
        probation: employees.filter(e => e.employmentStatus === 'PROBATION').length,
      },
      payroll: {
        total_monthly: totalPayroll,
        average_salary: employees.length > 0 ? totalPayroll / employees.length : 0,
      },
      department_breakdown: departmentBreakdown,
    };
  }

  async getScmMetrics(tenantId: string) {
    const inventory = await this.prisma.inventoryItem.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
      select: { currentStock: true, unitCost: true, stockStatus: true, reorderLevel: true, name: true },
    });

    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: { tenantId, deletedAt: null },
      select: { status: true, totalAmount: true, createdAt: true },
    });

    const totalInventoryValue = inventory.reduce((sum, i) => sum + i.currentStock * Number(i.unitCost), 0);
    const lowStockItems = inventory.filter(i => i.currentStock <= i.reorderLevel);

    return {
      inventory: {
        total_value: totalInventoryValue,
        total_items: inventory.length,
        low_stock: lowStockItems.length,
        out_of_stock: inventory.filter(i => i.stockStatus === 'OUT_OF_STOCK').length,
      },
      purchase_orders: {
        total: purchaseOrders.length,
        pending: purchaseOrders.filter(po => po.status === 'PENDING_APPROVAL').length,
        approved: purchaseOrders.filter(po => po.status === 'APPROVED').length,
        total_value: purchaseOrders.reduce((sum, po) => sum + Number(po.totalAmount), 0),
      },
      low_stock_items: lowStockItems.map(i => ({ name: i.name, stock: i.currentStock, reorder_level: i.reorderLevel })),
    };
  }

  async getCashFlowMetrics(tenantId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { tenantId, type: 'ASSET', subType: 'CURRENT_ASSET', isActive: true, deletedAt: null },
      select: { accountName: true, balance: true },
    });

    const cashPosition = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

    return {
      cash_position: cashPosition,
      accounts: accounts.map(a => ({
        name: a.accountName,
        balance: Number(a.balance),
      })),
      forecast: {
        note: 'Cash flow forecast available via ML service /predict endpoint',
      },
    };
  }
}
