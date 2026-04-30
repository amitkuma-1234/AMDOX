import { IsString, IsArray, IsEnum, IsOptional, IsBoolean, IsUUID, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ReportFrequencyEnum {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
}

export class ScheduleReportDto {
  @ApiProperty({ description: 'Report name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Cron expression (e.g., "0 8 * * 1" for Mondays 8 AM)' })
  @IsString()
  cronExpr: string;

  @ApiProperty({ enum: ReportFrequencyEnum })
  @IsEnum(ReportFrequencyEnum)
  frequency: ReportFrequencyEnum;

  @ApiProperty({ description: 'Email addresses to receive the report', type: [String] })
  @IsArray()
  @IsString({ each: true })
  recipients: string[];

  @ApiPropertyOptional({ description: 'Report template configuration JSON' })
  @IsObject()
  @IsOptional()
  template?: Record<string, any>;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId: string;

  @ApiProperty({ description: 'Creator user ID' })
  @IsUUID()
  createdBy: string;
}
