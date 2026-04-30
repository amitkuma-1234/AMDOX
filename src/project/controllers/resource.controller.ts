import { Controller, Get, Post, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResourceService } from '../services/resource.service';
import { AllocateResourceDto } from '../dto/allocate-resource.dto';

@ApiTags('Project Resources')
@ApiBearerAuth('access-token')
@Controller('projects/:projectId')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Post('allocate')
  @ApiOperation({ summary: 'Allocate employee to a task' })
  async allocate(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: AllocateResourceDto,
  ) {
    return this.resourceService.allocate(projectId, dto);
  }

  @Get('resource-utilisation')
  @ApiOperation({ summary: 'Get resource utilisation heatmap data' })
  async getUtilisation(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.resourceService.getUtilisation(projectId);
  }
}
