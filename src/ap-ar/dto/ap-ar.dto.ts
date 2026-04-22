import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, IsDateString, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Currency, InvoiceStatus } from '@prisma/client';

export class CreateApInvoiceDto {
  @ApiProperty({ example: 'INV-2024-VND01-001' })
  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  @ApiProperty({ example: 'vendor-uuid-here' })
  @IsString()
  @IsNotEmpty()
  vendorId!: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  invoiceDate!: string;

  @ApiProperty({ example: '2024-02-15' })
  @IsDateString()
  dueDate!: string;

  @ApiProperty({ example: 1000.50 })
  @IsNumber()
  @IsNotEmpty()
  totalAmount!: number;

  @ApiProperty({ example: 80.04 })
  @IsNumber()
  @IsOptional()
  taxAmount?: number = 0;

  @ApiProperty({ enum: Currency, default: Currency.USD })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency = Currency.USD;
}

export class CreateArInvoiceDto {
  @ApiProperty({ example: 'INV-2024-CUST01-001' })
  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  @ApiProperty({ example: 'ACME Corp Customer' })
  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @ApiProperty({ example: 'finance@acme.com' })
  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @ApiProperty({ example: '2024-01-20' })
  @IsDateString()
  invoiceDate!: string;

  @ApiProperty({ example: '2024-02-20' })
  @IsDateString()
  dueDate!: string;

  @ApiProperty({ example: 2500.00 })
  @IsNumber()
  @IsNotEmpty()
  totalAmount!: number;

  @ApiProperty({ enum: Currency, default: Currency.USD })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency = Currency.USD;
}
