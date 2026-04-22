import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { EmployeeRepository } from '../../database/repositories/employee.repository';
import { CreateEmployeeDto } from '../dto/hr.dto';

@Injectable()
export class HrService {
  private readonly logger = new Logger(HrService.name);

  constructor(private readonly employeeRepository: EmployeeRepository) {}

  async findAllEmployees(tenantId: string) {
    return this.employeeRepository.findActive(tenantId);
  }

  async createEmployee(dto: CreateEmployeeDto, tenantId: string) {
    this.logger.log(`Creating employee: ${dto.employeeCode} for tenant ${tenantId}`);

    const existing = await this.employeeRepository.findByCode(dto.employeeCode, tenantId);
    if (existing) {
      throw new BadRequestException(`Employee with code ${dto.employeeCode} already exists`);
    }

    return this.employeeRepository.create({
      ...dto,
      hireDate: new Date(dto.hireDate),
      tenantId,
    } as any);
  }

  async getEmployeeById(id: string, tenantId: string) {
    const employee = await this.employeeRepository.findById(id, tenantId);
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);
    return employee;
  }
}
