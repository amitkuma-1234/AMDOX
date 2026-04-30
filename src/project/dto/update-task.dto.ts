import { PartialType } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.dto';
import { IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

enum TaskStatusEnum { OPEN = 'OPEN', IN_PROGRESS = 'IN_PROGRESS', BLOCKED = 'BLOCKED', REVIEW = 'REVIEW', CLOSED = 'CLOSED' }

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({ enum: TaskStatusEnum }) @IsEnum(TaskStatusEnum) @IsOptional() status?: TaskStatusEnum;
  @ApiPropertyOptional() @IsNumber() @IsOptional() actualHours?: number;
}
