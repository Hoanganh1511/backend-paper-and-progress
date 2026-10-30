import { IsOptional, IsString } from 'class-validator';
import { TotpCodeDto } from './totp-code.dto.js';

export class TotpDisableDto extends TotpCodeDto {
  // Bỏ trống với user chỉ đăng nhập social (không có password)
  @IsOptional()
  @IsString()
  password?: string;
}
