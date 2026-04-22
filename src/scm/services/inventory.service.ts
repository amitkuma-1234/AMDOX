import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryRepository } from '../../database/repositories/inventory.repository';
import { PrismaService } from '../../database/prisma.service';
import { CreateInventoryItemDto } from '../dto/scm.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryRepository: InventoryRepository,
  ) {}

  async findAllItems(tenantId: string) {
    return this.inventoryRepository.findAll(tenantId); 
  }

  async createItem(dto: CreateInventoryItemDto, tenantId: string) {
    this.logger.log(`Creating inventory item: ${dto.sku} - ${dto.name}`);

    const existing = await this.inventoryRepository.findBySku(dto.sku, tenantId);
    if (existing) {
      throw new BadRequestException(`SKU ${dto.sku} already exists`);
    }

    return this.inventoryRepository.create({
      ...dto,
      tenantId,
    } as any);
  }

  async recordMovement(dto: any, tenantId: string) {
    this.logger.log(`Recording stock movement for item ${dto.inventoryItemId}`);
    
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          ...dto,
          timestamp: new Date(),
        },
      });

      await tx.inventoryItem.update({
        where: { id: dto.inventoryItemId },
        data: {
          currentStock: { increment: dto.quantity },
        },
      });

      return movement;
    });
  }
}
