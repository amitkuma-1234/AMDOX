import { IsString, IsOptional, IsDateString, IsNumber, IsUUID, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() startDate?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() endDate?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() estimatedHours?: number;
  @ApiPropertyOptional() @IsUUID() @IsOptional() parentTaskId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() assignedTo?: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() priority?: number;
}
