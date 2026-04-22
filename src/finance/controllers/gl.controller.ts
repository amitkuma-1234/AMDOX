import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '@auth/guards';
import { RequireRole } from '@auth/decorators/require-role.decorator';
import { GLService } from '@finance/services/gl.service';
import { CreateAccountDto, CreateJournalEntryDto } from '@finance/dto/gl.dto';
import { Currency } from '@prisma/client';

@ApiTags('Finance - General Ledger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance/gl')
export class GLController {
  constructor(private readonly glService: GLService) {}

  @Get('accounts')
  @RequireRole('admin', 'accountant', 'viewer')
  @ApiOperation({ summary: 'Get Chart of Accounts' })
  async getAccounts(@Req() req: any, @Query('isActive') isActive?: boolean) {
    return this.glService.getChartOfAccounts(req.user.tenantId, isActive);
  }

  @Post('accounts')
  @RequireRole('admin', 'accountant')
  @ApiOperation({ summary: 'Create a new account in COA' })
  async createAccount(@Body() dto: CreateAccountDto, @Req() req: any) {
    return this.glService.createAccount(dto, req.user.tenantId);
  }

  @Post('journal-entries')
  @RequireRole('admin', 'accountant')
  @ApiOperation({ summary: 'Post a manual journal entry' })
  async createJournalEntry(@Body() dto: CreateJournalEntryDto, @Req() req: any) {
    return this.glService.createJournalEntry(dto, req.user.tenantId);
  }

  @Get('trial-balance')
  @RequireRole('admin', 'accountant')
  @ApiOperation({ summary: 'Get Trial Balance' })
  async getTrialBalance(@Req() req: any, @Query('currency') currency?: Currency) {
    return this.glService.getTrialBalance(req.user.tenantId, currency);
  }
}
