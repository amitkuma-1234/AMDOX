import { Module } from '@nestjs/common';
import { ApController } from './controllers/ap.controller';
import { ArController } from './controllers/ar.controller';
import { ApService } from './services/ap.service';
import { ArService } from './services/ar.service';
import { DatabaseModule } from '../database/database.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [DatabaseModule, FinanceModule],
  controllers: [ApController, ArController],
  providers: [ApService, ArService],
  exports: [ApService, ArService],
})
export class ApArModule {}
