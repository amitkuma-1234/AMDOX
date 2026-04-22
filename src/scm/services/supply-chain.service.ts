import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePurchaseOrderDto, CreateGoodsReceiptDto } from '../dto/scm.dto';

@Injectable()
export class SupplyChainService {
  private readonly logger = new Logger(SupplyChainService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAllPurchaseOrders(tenantId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: { vendor: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, tenantId: string) {
    this.logger.log(`Creating Purchase Order: ${dto.orderNumber} for tenant ${tenantId}`);

    // Calculate totals
    const subtotal = dto.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const tax = subtotal * 0.1; // Simple 10% tax
    const total = subtotal + tax;

    return this.prisma.purchaseOrder.create({
      data: {
        orderNumber: dto.orderNumber,
        vendorId: dto.vendorId,
        items: dto.items as any,
        subtotal,
        taxAmount: tax,
        totalAmount: total,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        status: 'APPROVED',
        tenantId,
      },
    });
  }

  /**
   * Record a Goods Receipt and update Inventory.
   */
  async createGoodsReceipt(dto: CreateGoodsReceiptDto, tenantId: string) {
    this.logger.log(`Recording Goods Receipt: ${dto.receiptNumber} for PO ${dto.purchaseOrderId}`);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Goods Receipt
      const receipt = await tx.goodsReceipt.create({
        data: {
          receiptNumber: dto.receiptNumber,
          purchaseOrderId: dto.purchaseOrderId,
          receivedDate: new Date(dto.receivedDate),
          items: dto.items as any,
          tenantId,
        },
      });

      // 2. Update Inventory for each item
      for (const item of dto.items) {
        await tx.inventoryItem.update({
          where: { id: item.inventoryItemId },
          data: {
            currentStock: { increment: item.quantity },
          },
        });

        // 3. Log Movement
        await tx.stockMovement.create({
          data: {
            inventoryItemId: item.inventoryItemId,
            quantity: item.quantity,
            type: 'IN',
            reason: `Goods Receipt: ${dto.receiptNumber}`,
            reference: dto.purchaseOrderId,
          },
        });
      }

      // 4. Update PO status
      await tx.purchaseOrder.update({
        where: { id: dto.purchaseOrderId },
        data: { status: 'RECEIVED', receivedDate: new Date() },
      });

      return receipt;
    });
  }
}
