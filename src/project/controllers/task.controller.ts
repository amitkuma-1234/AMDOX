import { Controller, Get, Post, Patch, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TaskService } from '../services/task.service';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';

@ApiTags('Project Tasks')
@ApiBearerAuth('access-token')
@Controller('projects/:projectId/tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @ApiOperation({ summary: 'Create a task within a project' })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.taskService.create(projectId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get hierarchical task tree for a project' })
  async findAll(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.taskService.getTaskTree(projectId);
  }

  @Patch(':taskId')
  @ApiOperation({ summary: 'Update task (status, assignee, dates)' })
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.taskService.update(projectId, taskId, dto);
  }
}
