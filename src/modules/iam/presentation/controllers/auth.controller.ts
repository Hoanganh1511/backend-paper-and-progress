import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard.js';
import { SyncUserCommand } from '../../application/commands/sync-user.command.js';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private syncUser: SyncUserCommand) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    const user = await this.syncUser.execute({
      keycloakSub: req.user.sub,
      email: req.user.email,
    });
    return { data: user };
  }
}
