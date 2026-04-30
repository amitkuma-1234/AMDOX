import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WidgetController } from './controllers/widget.controller';
import { ReportController } from './controllers/report.controller';
import { MetricsController } from './controllers/metrics.controller';
import { WidgetService } from './services/widget.service';
import { ReportService } from './services/report.service';
import { MetricsService } from './services/metrics.service';
import { QueryExecutorService } from './services/query-executor.service';
import { ReportProcessor } from './processors/report.processor';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue(
      { name: 'report-generation' },
    ),
  ],
  controllers: [WidgetController, ReportController, MetricsController],
  providers: [
    WidgetService,
    ReportService,
    MetricsService,
    QueryExecutorService,
    ReportProcessor,
  ],
  exports: [WidgetService, ReportService, MetricsService],
})
export class DashboardModule {}
