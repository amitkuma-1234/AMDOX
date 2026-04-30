import { Controller, Get, Post, Put, Param, Body, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProjectService } from '../services/project.service';
import { GanttService } from '../services/gantt.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';

@ApiTags('Projects')
@ApiBearerAuth('access-token')
@Controller('projects')
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly ganttService: GanttService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  async create(@Body() dto: CreateProjectDto) {
    return this.projectService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List projects with filters' })
  @ApiQuery({ name: 'tenantId', required: true })
  @ApiQuery({ name: 'status', required: false })
  async findAll(
    @Query('tenantId') tenantId: string,
    @Query('status') status?: string,
  ) {
    return this.projectService.findAll(tenantId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project details' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update project' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.update(id, dto);
  }

  @Get(':id/gantt')
  @ApiOperation({ summary: 'Get project Gantt chart data (tasks, dependencies, critical path)' })
  async getGantt(@Param('id', ParseUUIDPipe) id: string) {
    return this.ganttService.getGanttData(id);
  }
}
