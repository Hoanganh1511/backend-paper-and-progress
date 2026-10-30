import { CriteriaPriority, CriteriaStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCriteriaDto {
  @IsUUID()
  categoryId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CriteriaStatus)
  status?: CriteriaStatus;

  @IsOptional()
  @IsEnum(CriteriaPriority)
  priority?: CriteriaPriority;

  /** ISO date string; PATCH có thể gửi null để xoá deadline */
  @IsOptional()
  @IsDateString()
  deadline?: string | null;

  @IsOptional()
  @IsBoolean()
  needsReview?: boolean;

  @IsOptional()
  @IsBoolean()
  needsDiscussion?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUrl()
  evidenceUrl?: string;
}
