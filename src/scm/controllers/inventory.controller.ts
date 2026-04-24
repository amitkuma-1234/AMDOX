import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '@auth/guards';
import { RequireRole } from '@auth/decorators/require-role.decorator';
import { InventoryService } from '@scm/services/inventory.service';
import { CreateInventoryItemDto } from '@scm/dto/scm.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('scm/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('items')
  @RequireRole('admin', 'inventory_manager', 'viewer')
  @ApiOperation({ summary: 'List all inventory items' })
  async getItems(@Req() req: any) {
    return this.inventoryService.findAllItems(req.user.tenantId);
  }

  @Post('items')
  @RequireRole('admin', 'inventory_manager')
  @ApiOperation({ summary: 'Create a new inventory item (SKU)' })
  async createItem(@Body() dto: CreateInventoryItemDto, @Req() req: any) {
    return this.inventoryService.createItem(dto, req.user.tenantId);
  }

  @Post('stock-movements')
  @RequireRole('admin', 'inventory_manager')
  @ApiOperation({ summary: 'Record a manual stock adjustment or transfer' })
  async recordMovement(@Body() dto: any, @Req() req: any) {
    return this.inventoryService.recordMovement(dto, req.user.tenantId);
  }
}
