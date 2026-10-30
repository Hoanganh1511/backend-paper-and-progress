import { CriteriaStatus, ProjectHealth } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const ISSUE_TYPES = [
  'BLOCKED',
  'OVERDUE',
  'NEEDS_REVIEW',
  'NEEDS_DISCUSSION',
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ACTIVITY_TYPES = [
  'STATUS_CHANGED',
  'CRITERIA_CREATED',
  'CRITERIA_UPDATED',
  'CRITERIA_DELETED',
  'CATEGORY_CREATED',
  'CATEGORY_DELETED',
  'NOTE_ADDED',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class ListCriteriaDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(CriteriaStatus)
  status?: CriteriaStatus;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Tìm trong title, description, tên category */
  @IsOptional()
  @IsString()
  @MinLength(1)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  override limit: number = 50;
}

export class ListIssuesDto extends PageQueryDto {
  @IsOptional()
  @IsIn(ISSUE_TYPES)
  type?: IssueType;
}

export class ListActivitiesDto extends PageQueryDto {
  @IsOptional()
  @IsIn(ACTIVITY_TYPES)
  type?: ActivityType;

  @IsOptional()
  @IsUUID()
  criteriaId?: string;
}

export class RecentActivitiesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 5;
}

export class UpdateProjectConfigDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ProjectHealth)
  health?: ProjectHealth;
}

export class OrderItemDto {
  @IsUUID()
  id: string;

  @IsInt()
  sortOrder: number;
}

export class ReorderDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  orders: OrderItemDto[];
}
