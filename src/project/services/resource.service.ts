import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AllocateResourceDto } from '../dto/allocate-resource.dto';

@Injectable()
export class ResourceService {
  private readonly logger = new Logger(ResourceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async allocate(projectId: string, dto: AllocateResourceDto) {
    return this.prisma.resourceAllocation.create({
      data: {
        taskId: dto.taskId,
        employeeId: dto.employeeId,
        allocation: dto.allocation,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        projectId,
      },
    });
  }

  async getUtilisation(projectId: string) {
    const allocations = await this.prisma.resourceAllocation.findMany({
      where: { projectId },
      orderBy: { startDate: 'asc' },
    });

    // Group by employee for heatmap data
    const employeeMap = new Map<string, { dates: { start: string; end: string; allocation: number }[] }>();

    for (const alloc of allocations) {
      const empId = alloc.employeeId;
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, { dates: [] });
      }
      employeeMap.get(empId)!.dates.push({
        start: alloc.startDate.toISOString().split('T')[0],
        end: alloc.endDate.toISOString().split('T')[0],
        allocation: Number(alloc.allocation),
      });
    }

    // Calculate total utilisation per employee
    const heatmapData = Array.from(employeeMap.entries()).map(([employeeId, data]) => ({
      employeeId,
      allocations: data.dates,
      totalAllocation: data.dates.reduce((sum, d) => sum + d.allocation, 0),
      isOverAllocated: data.dates.reduce((sum, d) => sum + d.allocation, 0) > 100,
    }));

    return {
      projectId,
      totalAllocations: allocations.length,
      employees: heatmapData,
      overAllocatedCount: heatmapData.filter(e => e.isOverAllocated).length,
    };
  }
}
