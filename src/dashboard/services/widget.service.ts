import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateWidgetDto } from '../dto/create-widget.dto';
import { UpdateWidgetDto } from '../dto/update-widget.dto';

@Injectable()
export class WidgetService {
  private readonly logger = new Logger(WidgetService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWidgetDto) {
    this.logger.log(`Creating widget "${dto.title}" for tenant ${dto.tenantId}`);
    return this.prisma.dashboardWidget.create({
      data: {
        title: dto.title,
        type: dto.type,
        query: dto.query,
        config: dto.config || {},
        position: dto.position || {},
        refreshInterval: dto.refreshInterval || 300,
        tenantId: dto.tenantId,
        createdBy: dto.createdBy,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.dashboardWidget.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const widget = await this.prisma.dashboardWidget.findUnique({ where: { id } });
    if (!widget || widget.deletedAt) {
      throw new NotFoundException(`Widget ${id} not found`);
    }
    return widget;
  }

  async update(id: string, dto: UpdateWidgetDto) {
    await this.findOne(id); // Ensure exists
    return this.prisma.dashboardWidget.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.type && { type: dto.type }),
        ...(dto.query && { query: dto.query }),
        ...(dto.config && { config: dto.config }),
        ...(dto.position && { position: dto.position }),
        ...(dto.refreshInterval && { refreshInterval: dto.refreshInterval }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.dashboardWidget.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
