import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '@auth/guards';
import { RequireRole } from '@auth/decorators/require-role.decorator';
import { SupplyChainService } from '@scm/services/supply-chain.service';
import { CreatePurchaseOrderDto, CreateGoodsReceiptDto } from '@scm/dto/scm.dto';

@ApiTags('Purchase Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('scm/procurement')
export class SupplyChainController {
  constructor(private readonly scmService: SupplyChainService) {}

  @Get('purchase-orders')
  @RequireRole('admin', 'procurement_manager', 'viewer')
  @ApiOperation({ summary: 'List all purchase orders' })
  async getPurchaseOrders(@Req() req: any) {
    return this.scmService.findAllPurchaseOrders(req.user.tenantId);
  }

  @Post('purchase-orders')
  @RequireRole('admin', 'procurement_manager')
  @ApiOperation({ summary: 'Create a new purchase order' })
  async createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto, @Req() req: any) {
    return this.scmService.createPurchaseOrder(dto, req.user.tenantId);
  }

  @Post('goods-receipts')
  @RequireRole('admin', 'inventory_manager')
  @ApiOperation({ summary: 'Record a goods receipt against a PO' })
  async createGoodsReceipt(@Body() dto: CreateGoodsReceiptDto, @Req() req: any) {
    return this.scmService.createGoodsReceipt(dto, req.user.tenantId);
  }
}
