import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';

@Processor('report-generation')
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ reportId: string; tenantId: string; immediate?: boolean }>): Promise<void> {
    const { reportId, tenantId } = job.data;
    this.logger.log(`Processing report ${reportId} for tenant ${tenantId}`);

    try {
      // Fetch report config
      const report = await this.prisma.scheduledReport.findUnique({
        where: { id: reportId },
      });

      if (!report || !report.isActive) {
        this.logger.warn(`Report ${reportId} not found or inactive`);
        return;
      }

      // Generate report (PDF/Excel based on template)
      this.logger.log(`Generating report "${report.name}"`);

      // TODO: Integrate Puppeteer for PDF generation
      // TODO: Integrate exceljs for XLSX generation
      // TODO: Send email with attachment to report.recipients

      // Update last run timestamp
      await this.prisma.scheduledReport.update({
        where: { id: reportId },
        data: {
          lastRunAt: new Date(),
          retryCount: 0,
        },
      });

      this.logger.log(`Report "${report.name}" generated and sent to ${report.recipients.length} recipients`);
    } catch (error) {
      this.logger.error(`Report generation failed: ${error.message}`, error.stack);

      // Increment retry count
      await this.prisma.scheduledReport.update({
        where: { id: reportId },
        data: { retryCount: { increment: 1 } },
      });

      throw error; // BullMQ will retry based on job config
    }
  }
}
