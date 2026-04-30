import { IsString, IsEnum, IsObject, IsOptional, IsInt, IsBoolean, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WidgetTypeEnum {
  BAR_CHART = 'BAR_CHART',
  LINE_CHART = 'LINE_CHART',
  PIE_CHART = 'PIE_CHART',
  HEATMAP = 'HEATMAP',
  TABLE = 'TABLE',
  KPI_CARD = 'KPI_CARD',
  FUNNEL = 'FUNNEL',
}

export class CreateWidgetDto {
  @ApiProperty({ description: 'Widget title' })
  @IsString()
  title: string;

  @ApiProperty({ enum: WidgetTypeEnum, description: 'Widget type' })
  @IsEnum(WidgetTypeEnum)
  type: WidgetTypeEnum;

  @ApiProperty({ description: 'SQL query or data source reference' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ description: 'Chart/display configuration JSON' })
  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Grid position { x, y, w, h }' })
  @IsObject()
  @IsOptional()
  position?: Record<string, number>;

  @ApiPropertyOptional({ description: 'Auto-refresh interval in seconds', default: 300 })
  @IsInt()
  @Min(30)
  @Max(86400)
  @IsOptional()
  refreshInterval?: number;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId: string;

  @ApiProperty({ description: 'Creator user ID' })
  @IsUUID()
  createdBy: string;
}
