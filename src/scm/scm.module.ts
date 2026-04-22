import { Module } from '@nestjs/common';
import { SupplyChainController } from './controllers/supply-chain.controller';
import { InventoryController } from './controllers/inventory.controller';
import { SupplyChainService } from './services/supply-chain.service';
import { InventoryService } from './services/inventory.service';
import { DatabaseModule } from '../database/database.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [DatabaseModule, FinanceModule],
  controllers: [SupplyChainController, InventoryController],
  providers: [SupplyChainService, InventoryService],
  exports: [SupplyChainService, InventoryService],
})
export class ScmModule {}
