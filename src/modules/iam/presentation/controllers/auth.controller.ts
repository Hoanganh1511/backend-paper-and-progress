import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard.js';
import { SyncUserCommand } from '../../application/commands/sync-user.command.js';
import {
  LoginCommand,
  LoginDto,
} from '../../application/commands/login.command.js';
import {
  RegisterCommand,
  RegisterDto,
} from '../../application/commands/register.command.js';
import {
  RefreshTokenCommand,
  RefreshTokenDto,
} from '../../application/commands/refresh-token.command.js';
import {
  LogoutCommand,
  LogoutDto,
} from '../../application/commands/logout.command.js';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private syncUserCommand: SyncUserCommand,
    private loginCommand: LoginCommand,
    private registerCommand: RegisterCommand,
    private refreshTokenCommand: RefreshTokenCommand,
    private logoutCommand: LogoutCommand,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    try {
      return await this.loginCommand.execute(dto);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
        throw new UnauthorizedException('Invalid email or password');
      }
      throw error;
    }
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.registerCommand.execute(dto);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.refreshTokenCommand.execute(dto);
  }

  @Post('logout')
  async logout(@Body() dto: LogoutDto) {
    return this.logoutCommand.execute(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Request() req: any) {
    return this.syncUserCommand.execute({
      keycloakSub: req.user.sub,
      email: req.user.email,
    });
  }
}
