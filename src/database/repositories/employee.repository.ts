import { Injectable } from '@nestjs/common';
import { Employee, EmploymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class EmployeeRepository extends BaseRepository<Employee> {
  protected readonly modelName = 'Employee';

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate() {
    return this.prisma.employee;
  }

  async findByCode(employeeCode: string, tenantId: string): Promise<Employee | null> {
    return this.prisma.employee.findFirst({
      where: { employeeCode, tenantId },
      include: { user: true, manager: true },
    });
  }

  async findActive(tenantId: string): Promise<Employee[]> {
    return this.prisma.employee.findMany({
      where: { tenantId, employmentStatus: EmploymentStatus.ACTIVE },
      include: { user: true, position: true } as any, // Position might be a string field or relation depending on schema
    });
  }

  async findForPayroll(tenantId: string): Promise<Employee[]> {
    return this.prisma.employee.findMany({
      where: {
        tenantId,
        employmentStatus: { in: [EmploymentStatus.ACTIVE, EmploymentStatus.PROBATION] },
      },
    });
  }
}
