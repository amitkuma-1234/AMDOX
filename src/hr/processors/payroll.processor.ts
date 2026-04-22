import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EmployeeRepository } from '../../database/repositories/employee.repository';
import { GLService } from '../../finance/services/gl.service';
import { TransactionType } from '@prisma/client';

@Processor('payroll')
export class PayrollProcessor extends WorkerHost {
  private readonly logger = new Logger(PayrollProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeRepository: EmployeeRepository,
    private readonly glService: GLService,
  ) {
    super();
  }

  /**
   * Process a queued payroll job.
   */
  async process(job: Job<any, any, string>): Promise<any> {
    const { payrollId, tenantId } = job.data;
    this.logger.log(`Starting background processing for payroll: ${payrollId}`);

    try {
      // ── Step 1: Fetch Employees ──────────────────────────────
      const employees = await this.employeeRepository.findForPayroll(tenantId);
      let totalGross = 0;
      let totalNet = 0;

      // ── Step 2: Calculate Salaries ──────────────────────────
      for (const employee of employees) {
        const salary = Number(employee.salary || 0);
        const tax = salary * 0.15; // Simple 15% tax for demonstration
        const net = salary - tax;

        await this.prisma.payrollItem.create({
          data: {
            payrollId,
            employeeId: employee.id,
            basicSalary: salary,
            taxAmount: tax,
            netSalary: net,
            allowances: 0,
            deductions: 0,
          },
        });

        totalGross += salary;
        totalNet += net;
      }

      // ── Step 3: Update Payroll Status ────────────────────────
      await this.prisma.payroll.update({
        where: { id: payrollId },
        data: {
          status: 'COMPLETED',
          totalGross,
          totalNet,
        },
      });

      // ── Step 4: Post to General Ledger ───────────────────────
      // Debit: Salary Expense, Credit: Salaries Payable
      const expenseAccount = await this.prisma.account.findFirst({
        where: { tenantId, glCode: '5100' }, // Salary Expense
      });
      const liabilityAccount = await this.prisma.account.findFirst({
        where: { tenantId, glCode: '2100' }, // Salaries Payable
      });

      if (expenseAccount && liabilityAccount) {
        await this.glService.createJournalEntry({
          reference: `PAY-${payrollId.substring(0, 8)}`,
          description: `Monthly Payroll Run: ${payrollId}`,
          entryDate: new Date().toISOString(),
          lines: [
            { accountId: expenseAccount.id, amount: totalGross, type: TransactionType.DEBIT },
            { accountId: liabilityAccount.id, amount: totalGross, type: TransactionType.CREDIT },
          ],
        }, tenantId);
      }

      this.logger.log(`Payroll ${payrollId} processed successfully. Total Gross: ${totalGross}`);
      return { success: true, totalGross };

    } catch (error) {
      this.logger.error(`Failed to process payroll ${payrollId}: ${error.message}`, error.stack);
      await this.prisma.payroll.update({
        where: { id: payrollId },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }
}
