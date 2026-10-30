import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { SECURITY_EVENT_TYPES } from '../services/security-event.service.js';

export class PaginationDto {
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

export class ListUsersDto extends PaginationDto {
  /** Tìm theo email (chứa, không phân biệt hoa thường) */
  @IsOptional()
  @IsString()
  search?: string;
}

export class DateRangeDto extends PaginationDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ListLoginHistoryDto extends DateRangeDto {
  /** Tìm theo email user hoặc IP (chứa) */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  ip?: string;
}

export class ListSecurityEventsDto extends DateRangeDto {
  @IsOptional()
  @IsIn(SECURITY_EVENT_TYPES)
  type?: (typeof SECURITY_EVENT_TYPES)[number];
}
