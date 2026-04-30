import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { ScheduleReportDto } from '../dto/schedule-report.dto';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('report-generation') private readonly reportQueue: Queue,
  ) {}

  async schedule(dto: ScheduleReportDto) {
    this.logger.log(`Scheduling report "${dto.name}" with cron "${dto.cronExpr}"`);

    const report = await this.prisma.scheduledReport.create({
      data: {
        name: dto.name,
        cronExpr: dto.cronExpr,
        frequency: dto.frequency,
        recipients: dto.recipients,
        template: dto.template || {},
        tenantId: dto.tenantId,
        createdBy: dto.createdBy,
      },
    });

    // Add repeatable BullMQ job
    await this.reportQueue.add(
      'generate-report',
      { reportId: report.id, tenantId: dto.tenantId },
      {
        repeat: { pattern: dto.cronExpr },
        jobId: `report-${report.id}`,
      },
    );

    return report;
  }

  async getHistory(tenantId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [reports, total] = await Promise.all([
      this.prisma.scheduledReport.findMany({
        where: { tenantId },
        orderBy: { lastRunAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.scheduledReport.count({ where: { tenantId } }),
    ]);

    return {
      data: reports,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async triggerNow(id: string) {
    const report = await this.prisma.scheduledReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException(`Report ${id} not found`);

    await this.reportQueue.add(
      'generate-report',
      { reportId: id, tenantId: report.tenantId, immediate: true },
      { priority: 1 },
    );

    return { status: 'queued', reportId: id };
  }

  async download(id: string, format: 'pdf' | 'excel') {
    const report = await this.prisma.scheduledReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException(`Report ${id} not found`);

    // Generate report content based on template
    const content = await this.generateReportContent(report, format);
    const mimeType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const ext = format === 'pdf' ? 'pdf' : 'xlsx';

    return {
      buffer: content,
      filename: `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${ext}`,
      mimeType,
    };
  }

  private async generateReportContent(report: any, format: string): Promise<Buffer> {
    // Placeholder: in production, use Puppeteer for PDF or exceljs for XLSX
    this.logger.log(`Generating ${format} report "${report.name}"`);
    const placeholder = Buffer.from(`Report: ${report.name}\nGenerated: ${new Date().toISOString()}\nFormat: ${format}`);
    return placeholder;
  }
}
