import { IsString, IsOptional, IsEnum, IsDateString, IsNumber, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() endDate?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() budget?: number;
  @ApiPropertyOptional() @IsUUID() @IsOptional() projectManager?: string;
  @ApiProperty() @IsUUID() tenantId: string;
}
