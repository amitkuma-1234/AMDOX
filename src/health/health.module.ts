import { Module } from '@nestjs/common';
<<<<<<< HEAD
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [TerminusModule, DatabaseModule],
=======
import { HealthController } from './health.controller';
import { DatabaseModule } from '../database/prisma.module';

@Module({
  imports: [DatabaseModule],
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
  controllers: [HealthController],
})
export class HealthModule {}
