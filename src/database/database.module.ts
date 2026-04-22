import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UserRepository } from './repositories/user.repository';
import { AccountRepository } from './repositories/account.repository';
import { TransactionRepository } from './repositories/transaction.repository';
import { JournalEntryRepository } from './repositories/journal-entry.repository';
import { VendorRepository } from './repositories/vendor.repository';
import { EmployeeRepository } from './repositories/employee.repository';
import { InventoryRepository } from './repositories/inventory.repository';

/**
 * Global database module providing PrismaService and all repositories.
 * Marked as @Global so it does not need to be imported in every module.
 */
@Global()
@Module({
  providers: [
    PrismaService,
    UserRepository,
    AccountRepository,
    TransactionRepository,
    JournalEntryRepository,
    VendorRepository,
    EmployeeRepository,
    InventoryRepository,
  ],
  exports: [
    PrismaService,
    UserRepository,
    AccountRepository,
    TransactionRepository,
    JournalEntryRepository,
    VendorRepository,
    EmployeeRepository,
    InventoryRepository,
  ],
})
export class DatabaseModule {}
