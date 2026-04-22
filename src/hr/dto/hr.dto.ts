import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, IsDateString, IsEmail, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Currency, EmploymentStatus, ContractType } from '@prisma/client';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'EMP-001' })
  @IsString()
  @IsNotEmpty()
  employeeCode!: string;

  @ApiProperty()
  @IsObject()
  @IsNotEmpty()
  personalInfo!: any;

  @ApiProperty({ enum: EmploymentStatus, default: EmploymentStatus.PROBATION })
  @IsEnum(EmploymentStatus)
  @IsOptional()
  employmentStatus?: EmploymentStatus = EmploymentStatus.PROBATION;

  @ApiProperty({ enum: ContractType, default: ContractType.FULL_TIME })
  @IsEnum(ContractType)
  @IsOptional()
  contractType?: ContractType = ContractType.FULL_TIME;

  @ApiProperty({ example: 'Engineering' })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiProperty({ example: 'Senior Developer' })
  @IsString()
  @IsOptional()
  position?: string;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  hireDate!: string;

  @ApiProperty({ example: 85000.00 })
  @IsNumber()
  @IsOptional()
  salary?: number;

  @ApiProperty({ enum: Currency, default: Currency.USD })
  @IsEnum(Currency)
  @IsOptional()
  salaryCurrency?: Currency = Currency.USD;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  userId?: string;
}

export class CreatePayrollRunDto {
  @ApiProperty({ example: 'Monthly Payroll - Jan 2024' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ example: '2024-01-31' })
  @IsDateString()
  periodEnd!: string;
}
