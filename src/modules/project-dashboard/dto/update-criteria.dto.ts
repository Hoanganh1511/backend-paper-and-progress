import { PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';
import { CreateCriteriaDto } from './create-criteria.dto.js';

export class UpdateCriteriaDto extends PartialType(CreateCriteriaDto) {
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
