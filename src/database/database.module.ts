import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UserRepository } from './repositories/user.repository';
import { AccountRepository } from './repositories/account.repository';
import { TransactionRepository } from './repositories/transaction.repository';

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
  ],
  exports: [
    PrismaService,
    UserRepository,
    AccountRepository,
    TransactionRepository,
  ],
})
export class DatabaseModule {}
