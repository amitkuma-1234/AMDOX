import { Injectable } from '@nestjs/common';
import { Vendor } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class VendorRepository extends BaseRepository<Vendor> {
  protected readonly modelName = 'Vendor';

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate() {
    return this.prisma.vendor;
  }

  async findByCode(code: string, tenantId: string): Promise<Vendor | null> {
    return this.prisma.vendor.findFirst({
      where: { code, tenantId },
    });
  }

  async findActive(tenantId: string): Promise<Vendor[]> {
    return this.prisma.vendor.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
