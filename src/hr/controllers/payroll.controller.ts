import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '@auth/guards';
import { RequireRole } from '@auth/decorators/require-role.decorator';
import { PayrollService } from '@hr/services/payroll.service';
import { CreatePayrollRunDto } from '@hr/dto/hr.dto';

@ApiTags('HR - Payroll Processing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr/payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('run')
  @RequireRole('admin', 'hr_manager')
  @ApiOperation({ summary: 'Trigger a payroll run for the current period' })
  async runPayroll(@Body() dto: CreatePayrollRunDto, @Req() req: any) {
    return this.payrollService.triggerPayrollRun(dto, req.user.tenantId);
  }

  @Get('status/:runId')
  @RequireRole('admin', 'hr_manager')
  @ApiOperation({ summary: 'Get the status of a specific payroll run' })
  async getStatus(@Param('runId') runId: string) {
    return this.payrollService.getPayrollStatus(runId);
  }
}
