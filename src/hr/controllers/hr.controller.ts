import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '@auth/guards';
import { RequireRole } from '@auth/decorators/require-role.decorator';
import { HrService } from '@hr/services/hr.service';
import { CreateEmployeeDto } from '@hr/dto/hr.dto';

@ApiTags('HR - Employee Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr/employees')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Get()
  @RequireRole('admin', 'hr_manager', 'viewer')
  @ApiOperation({ summary: 'List all employees' })
  async getEmployees(@Req() req: any) {
    return this.hrService.findAllEmployees(req.user.tenantId);
  }

  @Post()
  @RequireRole('admin', 'hr_manager')
  @ApiOperation({ summary: 'Create a new employee record' })
  async createEmployee(@Body() dto: CreateEmployeeDto, @Req() req: any) {
    return this.hrService.createEmployee(dto, req.user.tenantId);
  }
}
