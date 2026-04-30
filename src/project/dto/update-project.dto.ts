import { PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

enum ProjectStatusEnum { PLANNING = 'PLANNING', ACTIVE = 'ACTIVE', ON_HOLD = 'ON_HOLD', CLOSED = 'CLOSED', CANCELLED = 'CANCELLED' }

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({ enum: ProjectStatusEnum }) @IsEnum(ProjectStatusEnum) @IsOptional() status?: ProjectStatusEnum;
}
