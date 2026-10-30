import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { TotpService } from './services/totp.service.js';
import { TotpCodeDto } from './dtos/totp-code.dto.js';
import { TotpDisableDto } from './dtos/totp-disable.dto.js';

class TotpStatusResponse {
  @ApiProperty()
  enabled: boolean;
}

type AuthedRequest = { user: { sub: string }; ip?: string };

@Controller('api/v1/auth/totp')
@UseGuards(JwtAuthGuard)
export class TotpController {
  constructor(private totpService: TotpService) {}

  @Get('status')
  @ApiOkResponse({ type: TotpStatusResponse })
  async status(@Req() req: AuthedRequest) {
    return { enabled: await this.totpService.isEnabled(req.user.sub) };
  }

  @Post('setup')
  @HttpCode(200)
  setup(@Req() req: AuthedRequest) {
    return this.totpService.setup(req.user.sub);
  }

  @Post('enable')
  @HttpCode(200)
  enable(@Req() req: AuthedRequest, @Body() dto: TotpCodeDto) {
    return this.totpService.verifyAndEnable(req.user.sub, dto.code);
  }

  @Post('disable')
  @HttpCode(200)
  async disable(@Req() req: AuthedRequest, @Body() dto: TotpDisableDto) {
    await this.totpService.disable(
      req.user.sub,
      dto.code,
      dto.password,
      req.ip,
    );
    return { disabled: true };
  }

  @Post('recovery-codes')
  @HttpCode(200)
  regenerateRecoveryCodes(@Req() req: AuthedRequest, @Body() dto: TotpCodeDto) {
    return this.totpService.regenerateRecoveryCodes(
      req.user.sub,
      dto.code,
      req.ip,
    );
  }
}
