import { IsString } from 'class-validator';
import { TotpCodeDto } from './totp-code.dto.js';

export class TotpLoginDto extends TotpCodeDto {
  @IsString()
  mfaToken: string;
}
