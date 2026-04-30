import {
  Controller,
  Get,
  Query,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Observable, interval, map } from 'rxjs';
import { MetricsService } from '../services/metrics.service';

@ApiTags('Metrics')
@ApiBearerAuth('access-token')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('financial')
  @ApiOperation({ summary: 'Get financial metrics (GL balances, P&L)' })
  @ApiQuery({ name: 'tenantId', required: true })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getFinancialMetrics(
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.metricsService.getFinancialMetrics(tenantId, startDate, endDate);
  }

  @Get('hr')
  @ApiOperation({ summary: 'Get HR metrics (headcount, payroll)' })
  @ApiQuery({ name: 'tenantId', required: true })
  async getHrMetrics(@Query('tenantId') tenantId: string) {
    return this.metricsService.getHrMetrics(tenantId);
  }

  @Get('scm')
  @ApiOperation({ summary: 'Get SCM metrics (inventory value, PO aging)' })
  @ApiQuery({ name: 'tenantId', required: true })
  async getScmMetrics(@Query('tenantId') tenantId: string) {
    return this.metricsService.getScmMetrics(tenantId);
  }

  @Get('cash-flow')
  @ApiOperation({ summary: 'Get cash flow metrics (forecast vs actual)' })
  @ApiQuery({ name: 'tenantId', required: true })
  async getCashFlowMetrics(@Query('tenantId') tenantId: string) {
    return this.metricsService.getCashFlowMetrics(tenantId);
  }

  @Sse('stream')
  @ApiOperation({ summary: 'Real-time metrics stream via SSE (30s intervals)' })
  metricsStream(@Query('tenantId') tenantId: string): Observable<MessageEvent> {
    return interval(30000).pipe(
      map(() => ({
        data: JSON.stringify({
          timestamp: new Date().toISOString(),
          tenantId,
          type: 'metrics_update',
        }),
        type: 'metrics',
      })),
    );
  }
}
