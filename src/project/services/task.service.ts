import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, dto: CreateTaskDto) {
    // Validate parent task belongs to same project
    if (dto.parentTaskId) {
      const parent = await this.prisma.projectTask.findFirst({
        where: { id: dto.parentTaskId, projectId },
      });
      if (!parent) throw new BadRequestException('Parent task not found in this project');
    }

    return this.prisma.projectTask.create({
      data: {
        title: dto.title,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        estimatedHours: dto.estimatedHours,
        parentTaskId: dto.parentTaskId,
        assignedTo: dto.assignedTo,
        priority: dto.priority || 0,
        projectId,
      },
    });
  }

  async getTaskTree(projectId: string) {
    // Fetch root tasks with nested subtasks
    const tasks = await this.prisma.projectTask.findMany({
      where: { projectId, parentTaskId: null },
      include: {
        subtasks: {
          include: {
            subtasks: { include: { subtasks: true } },  // 3 levels deep
          },
        },
        dependenciesAsPredecessor: true,
        dependenciesAsSuccessor: true,
      },
      orderBy: [{ priority: 'desc' }, { sortOrder: 'asc' }],
    });

    return { projectId, tasks, total: tasks.length };
  }

  async update(projectId: string, taskId: string, dto: UpdateTaskDto) {
    const task = await this.prisma.projectTask.findFirst({
      where: { id: taskId, projectId },
    });
    if (!task) throw new NotFoundException(`Task ${taskId} not found in project ${projectId}`);

    return this.prisma.projectTask.update({
      where: { id: taskId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status && { status: dto.status as any }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        ...(dto.assignedTo && { assignedTo: dto.assignedTo }),
        ...(dto.actualHours !== undefined && { actualHours: dto.actualHours }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
      },
    });
  }

  /**
   * DAG validation: prevent circular dependencies.
   */
  async addDependency(predecessorId: string, successorId: string): Promise<void> {
    // Check if adding this dependency would create a cycle
    const visited = new Set<string>();
    const hasCycle = await this.detectCycle(successorId, predecessorId, visited);
    if (hasCycle) {
      throw new BadRequestException('Adding this dependency would create a circular reference');
    }

    await this.prisma.taskDependency.create({
      data: { predecessorId, successorId },
    });
  }

  private async detectCycle(fromId: string, targetId: string, visited: Set<string>): Promise<boolean> {
    if (fromId === targetId) return true;
    if (visited.has(fromId)) return false;
    visited.add(fromId);

    const deps = await this.prisma.taskDependency.findMany({
      where: { predecessorId: fromId },
      select: { successorId: true },
    });

    for (const dep of deps) {
      if (await this.detectCycle(dep.successorId, targetId, visited)) {
        return true;
      }
    }
    return false;
  }
}
