import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, IsArray, ValidateNested, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Currency, StockStatus } from '@prisma/client';

export class CreateInventoryItemDto {
  @ApiProperty({ example: 'SKU-001' })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiProperty({ example: 'Laptop Pro 15' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @IsOptional()
  reorderLevel?: number = 10;

  @ApiProperty({ example: 1200.00 })
  @IsNumber()
  @IsNotEmpty()
  unitCost!: number;

  @ApiProperty({ enum: Currency, default: Currency.USD })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency = Currency.USD;
}

export class PurchaseOrderItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  inventoryItemId!: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: 100.00 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ example: 'PO-2024-001' })
  @IsString()
  @IsNotEmpty()
  orderNumber!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  vendorId!: string;

  @ApiProperty({ type: [PurchaseOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];

  @ApiProperty({ example: '2024-02-01' })
  @IsDateString()
  @IsOptional()
  expectedDate?: string;
}

export class CreateGoodsReceiptDto {
  @ApiProperty({ example: 'GR-2024-001' })
  @IsString()
  @IsNotEmpty()
  receiptNumber!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  purchaseOrderId!: string;

  @ApiProperty({ example: '2024-01-25' })
  @IsDateString()
  receivedDate!: string;

  @ApiProperty()
  @IsArray()
  items!: any[]; // Simplified for now
}
