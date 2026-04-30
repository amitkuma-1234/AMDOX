import { Module } from '@nestjs/common';
import { ProjectController } from './controllers/project.controller';
import { TaskController } from './controllers/task.controller';
import { ResourceController } from './controllers/resource.controller';
import { ProjectService } from './services/project.service';
import { TaskService } from './services/task.service';
import { GanttService } from './services/gantt.service';
import { ResourceService } from './services/resource.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ProjectController, TaskController, ResourceController],
  providers: [ProjectService, TaskService, GanttService, ResourceService],
  exports: [ProjectService, TaskService, GanttService],
})
export class ProjectModule {}
