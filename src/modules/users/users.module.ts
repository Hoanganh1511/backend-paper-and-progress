import { Module } from '@nestjs/common';
import { UsersController } from './presentation/users.controller.js';
import { UserProfileRepository } from './infrastructure/users.repository.js';
import { GetProfileQuery } from './application/queries/get-profile.query.js';
import { UpdateProfileCommand } from './application/commands/update-profile.command.js';
import { UploadAvatarCommand } from './application/commands/upload-avatar.command.js';
import { ChangePasswordCommand } from './application/commands/change-password.command.js';
import { DeleteAccountCommand } from './application/commands/delete-account.command.js';

@Module({
  controllers: [UsersController],
  providers: [
    UserProfileRepository,
    GetProfileQuery,
    UpdateProfileCommand,
    UploadAvatarCommand,
    ChangePasswordCommand,
    DeleteAccountCommand,
  ],
})
export class UsersModule {}
