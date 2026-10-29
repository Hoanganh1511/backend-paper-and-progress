import {
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  IsIn,
} from 'class-validator';
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s-]{7,20}$/, { message: 'Số điện thoại không hợp lệ' })
  phone?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsIn(['vi', 'en'])
  locale?: string;

  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: string;
}
