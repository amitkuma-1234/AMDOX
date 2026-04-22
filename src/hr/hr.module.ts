import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HrController } from './controllers/hr.controller';
import { PayrollController } from './controllers/payroll.controller';
import { HrService } from './services/hr.service';
import { PayrollService } from './services/payroll.service';
import { PayrollProcessor } from './processors/payroll.processor';
import { DatabaseModule } from '../database/database.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    DatabaseModule,
    FinanceModule,
    BullModule.registerQueue({
      name: 'payroll',
    }),
  ],
  controllers: [HrController, PayrollController],
  providers: [HrService, PayrollService, PayrollProcessor],
  exports: [HrService, PayrollService],
})
export class HrModule {}
