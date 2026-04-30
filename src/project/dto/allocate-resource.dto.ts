import { IsUUID, IsNumber, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AllocateResourceDto {
  @ApiProperty() @IsUUID() taskId: string;
  @ApiProperty() @IsUUID() employeeId: string;
  @ApiProperty({ description: 'Allocation percentage (1-100)' })
  @IsNumber() @Min(1) @Max(100) allocation: number;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
}
