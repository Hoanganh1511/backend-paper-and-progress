import { Module } from '@nestjs/common';
import { AuthController } from './presentation/controllers/auth.controller.js';
import { SyncUserCommand } from './application/commands/sync-user.command.js';
import { UserPrismaRepository } from './infrastructure/repositories/user.prisma-repository.js';
import { USER_REPOSITORY } from './domain/ports/user.repository.port.js';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    SyncUserCommand,
    JwtAuthGuard,
    {
      provide: USER_REPOSITORY,
      useClass: UserPrismaRepository,
    },
  ],
  exports: [SyncUserCommand],
})
export class IamModule {}
