import { IsString, Length } from 'class-validator';

export class TotpCodeDto {
  @IsString()
  @Length(6, 32) // 6 số TOTP hoặc recovery code
  code: string;
}
