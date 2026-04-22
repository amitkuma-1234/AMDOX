import { Module } from '@nestjs/common';
import { GLController } from './controllers/gl.controller';
import { GLService } from './services/gl.service';
import { CurrencyRateService } from './services/currency-rate.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [GLController],
  providers: [GLService, CurrencyRateService],
  exports: [GLService, CurrencyRateService],
})
export class FinanceModule {}
