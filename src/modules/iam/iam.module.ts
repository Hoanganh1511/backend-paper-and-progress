import { Module } from '@nestjs/common';
import { AuthController } from './presentation/controllers/auth.controller.js';
import { SyncUserCommand } from './application/commands/sync-user.command.js';
import { LoginCommand } from './application/commands/login.command.js';
import { RegisterCommand } from './application/commands/register.command.js';
import { RefreshTokenCommand } from './application/commands/refresh-token.command.js';
import { LogoutCommand } from './application/commands/logout.command.js';
import { UserPrismaRepository } from './infrastructure/repositories/user.prisma-repository.js';
import { USER_REPOSITORY } from './domain/ports/user.repository.port.js';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    SyncUserCommand,
    LoginCommand,
    RegisterCommand,
    RefreshTokenCommand,
    LogoutCommand,
    JwtAuthGuard,
    { provide: USER_REPOSITORY, useClass: UserPrismaRepository },
  ],
})
export class IamModule {}
