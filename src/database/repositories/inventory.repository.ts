import { Injectable } from '@nestjs/common';
import { InventoryItem, StockStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class InventoryRepository extends BaseRepository<InventoryItem> {
  protected readonly modelName = 'InventoryItem';

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate() {
    return this.prisma.inventoryItem;
  }

  async findBySku(sku: string, tenantId: string): Promise<InventoryItem | null> {
    return this.prisma.inventoryItem.findFirst({
      where: { sku, tenantId },
    });
  }

  async findLowStock(tenantId: string): Promise<InventoryItem[]> {
    return this.prisma.inventoryItem.findMany({
      where: {
        tenantId,
        currentStock: { lte: this.prisma.inventoryItem.fields.reorderLevel as any },
      },
    });
  }

  async updateStock(id: string, quantityChange: number): Promise<InventoryItem> {
    return this.prisma.inventoryItem.update({
      where: { id },
      data: {
        currentStock: { increment: quantityChange },
      },
    });
  }
}
