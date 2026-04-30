import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto) {
    this.logger.log(`Creating project "${dto.name}" for tenant ${dto.tenantId}`);
    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        budget: dto.budget,
        projectManager: dto.projectManager,
        tenantId: dto.tenantId,
      },
    });
  }

  async findAll(tenantId: string, status?: string) {
    return this.prisma.project.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(status && { status: status as any }),
      },
      include: {
        _count: { select: { tasks: true, milestones: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        tasks: { where: { parentTaskId: null }, include: { subtasks: true } },
        milestones: { orderBy: { dueDate: 'asc' } },
        _count: { select: { tasks: true, milestones: true, resourceAllocations: true } },
      },
    });
    if (!project || project.deletedAt) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);
    return this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        ...(dto.budget !== undefined && { budget: dto.budget }),
        ...(dto.status && { status: dto.status as any }),
        ...(dto.projectManager && { projectManager: dto.projectManager }),
      },
    });
  }
}
