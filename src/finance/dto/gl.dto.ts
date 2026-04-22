import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, IsArray, ValidateNested, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AccountType, AccountSubType, Currency, TransactionType } from '@prisma/client';

export class CreateAccountDto {
  @ApiProperty({ example: 'Operating Bank Account' })
  @IsString()
  @IsNotEmpty()
  accountName!: string;

  @ApiProperty({ example: '1001' })
  @IsString()
  @IsNotEmpty()
  glCode!: string;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  type!: AccountType;

  @ApiProperty({ enum: AccountSubType, required: false })
  @IsEnum(AccountSubType)
  @IsOptional()
  subType?: AccountSubType;

  @ApiProperty({ enum: Currency, default: Currency.USD })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency = Currency.USD;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @IsOptional()
  openingBalance?: number = 0;
}

export class JournalEntryLineDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateJournalEntryDto {
  @ApiProperty({ example: 'JE-2024-001' })
  @IsString()
  @IsNotEmpty()
  reference!: string;

  @ApiProperty({ example: 'Initial capital contribution' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  entryDate!: string;

  @ApiProperty({ type: [JournalEntryLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalEntryLineDto)
  lines!: JournalEntryLineDto[];
}
