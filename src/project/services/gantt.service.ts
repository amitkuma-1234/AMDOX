import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface GanttTask {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  assignedTo: string | null;
  parentTaskId: string | null;
  estimatedHours: number;
  actualHours: number;
  dependencies: string[];
  isCritical: boolean;
  slack: number; // float in days
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
}

export interface GanttData {
  projectId: string;
  projectName: string;
  startDate: string;
  endDate: string | null;
  tasks: GanttTask[];
  milestones: any[];
  criticalPath: string[]; // task IDs on critical path
  totalDuration: number;
}

@Injectable()
export class GanttService {
  private readonly logger = new Logger(GanttService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get complete Gantt chart data with critical path analysis.
   */
  async getGanttData(projectId: string): Promise<GanttData> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          include: {
            dependenciesAsPredecessor: true,
            dependenciesAsSuccessor: true,
          },
        },
        milestones: { orderBy: { dueDate: 'asc' } },
      },
    });

    if (!project) throw new Error(`Project ${projectId} not found`);

    // Build task graph
    const taskMap = new Map<string, any>();
    const adjList = new Map<string, string[]>();   // predecessor -> successors
    const inDegree = new Map<string, number>();

    for (const task of project.tasks) {
      taskMap.set(task.id, task);
      adjList.set(task.id, []);
      inDegree.set(task.id, 0);
    }

    for (const task of project.tasks) {
      for (const dep of task.dependenciesAsSuccessor) {
        adjList.get(dep.predecessorId)?.push(task.id);
        inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
      }
    }

    // Calculate durations (in days, based on dates or estimated hours / 8)
    const durations = new Map<string, number>();
    for (const task of project.tasks) {
      let duration = 1;
      if (task.startDate && task.endDate) {
        duration = Math.max(1, Math.ceil(
          (new Date(task.endDate).getTime() - new Date(task.startDate).getTime()) / (1000 * 60 * 60 * 24)
        ));
      } else if (task.estimatedHours) {
        duration = Math.max(1, Math.ceil(Number(task.estimatedHours) / 8));
      }
      durations.set(task.id, duration);
    }

    // Forward pass: calculate Early Start (ES) and Early Finish (EF)
    const earlyStart = new Map<string, number>();
    const earlyFinish = new Map<string, number>();
    const topoOrder = this.topologicalSort(project.tasks.map(t => t.id), adjList, inDegree);

    for (const taskId of topoOrder) {
      const task = taskMap.get(taskId)!;
      let es = 0;

      // ES = max(EF of all predecessors)
      for (const dep of task.dependenciesAsSuccessor) {
        const predEf = earlyFinish.get(dep.predecessorId) || 0;
        es = Math.max(es, predEf + (dep.lagDays || 0));
      }

      earlyStart.set(taskId, es);
      earlyFinish.set(taskId, es + (durations.get(taskId) || 1));
    }

    // Total project duration
    const totalDuration = Math.max(...Array.from(earlyFinish.values()), 0);

    // Backward pass: calculate Late Start (LS) and Late Finish (LF)
    const lateStart = new Map<string, number>();
    const lateFinish = new Map<string, number>();

    for (const taskId of [...topoOrder].reverse()) {
      const successors = adjList.get(taskId) || [];

      if (successors.length === 0) {
        lateFinish.set(taskId, totalDuration);
      } else {
        const minLs = Math.min(...successors.map(s => lateStart.get(s) || totalDuration));
        lateFinish.set(taskId, minLs);
      }

      lateStart.set(taskId, (lateFinish.get(taskId) || totalDuration) - (durations.get(taskId) || 1));
    }

    // Calculate slack and identify critical path
    const criticalPath: string[] = [];
    const ganttTasks: GanttTask[] = [];

    for (const task of project.tasks) {
      const es = earlyStart.get(task.id) || 0;
      const ef = earlyFinish.get(task.id) || 0;
      const ls = lateStart.get(task.id) || 0;
      const lf = lateFinish.get(task.id) || 0;
      const slack = ls - es;
      const isCritical = slack === 0;

      if (isCritical) criticalPath.push(task.id);

      ganttTasks.push({
        id: task.id,
        title: task.title,
        startDate: task.startDate?.toISOString().split('T')[0] || null,
        endDate: task.endDate?.toISOString().split('T')[0] || null,
        status: task.status,
        assignedTo: task.assignedTo,
        parentTaskId: task.parentTaskId,
        estimatedHours: Number(task.estimatedHours || 0),
        actualHours: Number(task.actualHours || 0),
        dependencies: task.dependenciesAsSuccessor.map((d: any) => d.predecessorId),
        isCritical,
        slack,
        earlyStart: es,
        earlyFinish: ef,
        lateStart: ls,
        lateFinish: lf,
      });
    }

    return {
      projectId: project.id,
      projectName: project.name,
      startDate: project.startDate.toISOString().split('T')[0],
      endDate: project.endDate?.toISOString().split('T')[0] || null,
      tasks: ganttTasks,
      milestones: project.milestones.map(m => ({
        id: m.id,
        name: m.name,
        dueDate: m.dueDate.toISOString().split('T')[0],
        status: m.status,
      })),
      criticalPath,
      totalDuration,
    };
  }

  /**
   * Topological sort using Kahn's algorithm.
   */
  private topologicalSort(
    nodeIds: string[],
    adjList: Map<string, string[]>,
    inDegree: Map<string, number>,
  ): string[] {
    const queue: string[] = [];
    const result: string[] = [];
    const inDegCopy = new Map(inDegree);

    for (const id of nodeIds) {
      if ((inDegCopy.get(id) || 0) === 0) queue.push(id);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const neighbor of (adjList.get(current) || [])) {
        inDegCopy.set(neighbor, (inDegCopy.get(neighbor) || 1) - 1);
        if (inDegCopy.get(neighbor) === 0) queue.push(neighbor);
      }
    }

    return result;
  }
}
