import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '@auth/guards';
import { RequireRole } from '@auth/decorators/require-role.decorator';
import { ArService } from '@ap-ar/services/ar.service';
import { CreateArInvoiceDto } from '@ap-ar/dto/ap-ar.dto';

@ApiTags('Finance - Accounts Receivable')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance/ar')
export class ArController {
  constructor(private readonly arService: ArService) {}

  @Get('invoices')
  @RequireRole('admin', 'accountant', 'sales_manager')
  @ApiOperation({ summary: 'List all AR invoices' })
  async getInvoices(@Req() req: any) {
    return this.arService.findAllInvoices(req.user.tenantId);
  }

  @Post('invoices')
  @RequireRole('admin', 'accountant')
  @ApiOperation({ summary: 'Create a new AR invoice' })
  async createInvoice(@Body() dto: CreateArInvoiceDto, @Req() req: any) {
    return this.arService.createInvoice(dto, req.user.tenantId);
  }
}
