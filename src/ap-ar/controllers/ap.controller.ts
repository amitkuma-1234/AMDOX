import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '@auth/guards';
import { RequireRole } from '@auth/decorators/require-role.decorator';
import { ApService } from '@ap-ar/services/ap.service';
import { CreateApInvoiceDto } from '@ap-ar/dto/ap-ar.dto';

@ApiTags('Finance - Accounts Payable')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance/ap')
export class ApController {
  constructor(private readonly apService: ApService) {}

  @Get('vendors')
  @RequireRole('admin', 'accountant', 'procurement_manager')
  @ApiOperation({ summary: 'List all vendors' })
  async getVendors(@Req() req: any) {
    return this.apService.findAllVendors(req.user.tenantId);
  }

  @Post('invoices')
  @RequireRole('admin', 'accountant')
  @ApiOperation({ summary: 'Create a new AP invoice' })
  async createInvoice(@Body() dto: CreateApInvoiceDto, @Req() req: any) {
    return this.apService.createInvoice(dto, req.user.tenantId);
  }
}
