import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WidgetService } from '../services/widget.service';
import { CreateWidgetDto } from '../dto/create-widget.dto';
import { UpdateWidgetDto } from '../dto/update-widget.dto';

@ApiTags('Dashboard Widgets')
@ApiBearerAuth('access-token')
@Controller('dashboard/widgets')
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  @Post()
  @ApiOperation({ summary: 'Create a dashboard widget' })
  async create(@Body() dto: CreateWidgetDto) {
    return this.widgetService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all widgets for current tenant' })
  @ApiQuery({ name: 'tenantId', required: true })
  async findAll(@Query('tenantId') tenantId: string) {
    return this.widgetService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get widget by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.widgetService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update widget configuration' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWidgetDto,
  ) {
    return this.widgetService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a widget' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.widgetService.remove(id);
  }
}
