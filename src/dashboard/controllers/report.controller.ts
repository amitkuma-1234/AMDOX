import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportService } from '../services/report.service';
import { ScheduleReportDto } from '../dto/schedule-report.dto';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('scheduled')
  @ApiOperation({ summary: 'Schedule a recurring report' })
  async scheduleReport(@Body() dto: ScheduleReportDto) {
    return this.reportService.schedule(dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get report execution history' })
  async getHistory(
    @Query('tenantId') tenantId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.reportService.getHistory(tenantId, page, limit);
  }

  @Post(':id/send-now')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger immediate report generation and send' })
  async sendNow(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportService.triggerNow(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download generated report (PDF/Excel)' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format: 'pdf' | 'excel' = 'pdf',
    @Res() res: Response,
  ) {
    const { buffer, filename, mimeType } = await this.reportService.download(id, format);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
