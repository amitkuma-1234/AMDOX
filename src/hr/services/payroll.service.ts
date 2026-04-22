import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { CreatePayrollRunDto } from '../dto/hr.dto';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    @InjectQueue('payroll') private readonly payrollQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Initialize a payroll run and queue it for processing.
   */
  async triggerPayrollRun(dto: CreatePayrollRunDto, tenantId: string) {
    this.logger.log(`Triggering payroll run: ${dto.name} for tenant ${tenantId}`);

    // ── Step 1: Create Payroll Record ──────────────────────────
    const payroll = await this.prisma.payroll.create({
      data: {
        name: dto.name,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        status: 'PROCESSING',
        tenantId,
      },
    });

    // ── Step 2: Queue Job ─────────────────────────────────────
    await this.payrollQueue.add(
      'process-payroll',
      { payrollId: payroll.id, tenantId },
      { jobId: payroll.id }, // Ensure uniqueness
    );

    return {
      message: 'Payroll processing started',
      payrollId: payroll.id,
    };
  }

  async getPayrollStatus(payrollId: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id: payrollId },
      include: { items: { include: { employee: true } } },
    });

    if (!payroll) throw new BadRequestException('Payroll run not found');

    const job = await this.payrollQueue.getJob(payrollId);
    
    return {
      ...payroll,
      jobStatus: job ? await job.getState() : 'completed',
    };
  }
}
