import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { GetProfileQuery } from '../application/queries/get-profile.query.js';
import { UpdateProfileCommand } from '../application/commands/update-profile.command.js';
import { UploadAvatarCommand } from '../application/commands/upload-avatar.command.js';
import { ChangePasswordCommand } from '../application/commands/change-password.command.js';
import { DeleteAccountCommand } from '../application/commands/delete-account.command.js';
import { UpdateProfileDto } from '../application/dtos/update-profile.dto.js';
import { ChangePasswordDto } from '../application/dtos/change-password.dto.js';

@Controller('api/v1/users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private getProfileQuery: GetProfileQuery,
    private updateProfileCommand: UpdateProfileCommand,
    private uploadAvatarCommand: UploadAvatarCommand,
    private changePasswordCommand: ChangePasswordCommand,
    private deleteAccountCommand: DeleteAccountCommand,
  ) {}

  @Get('profile')
  async getProfile(@Request() req: any) {
    return this.getProfileQuery.execute(req.user.sub, req.user.email);
  }

  @Patch('profile')
  async updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.updateProfileCommand.execute(req.user.sub, dto);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('avatar', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  async uploadAvatar(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploadAvatarCommand.execute(req.user.sub, file);
  }

  @Delete('avatar')
  @HttpCode(204)
  async deleteAvatar(@Request() req: any) {
    await this.uploadAvatarCommand.delete(req.user.sub);
  }

  @Post('change-password')
  async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.changePasswordCommand.execute(req.user.sub, dto);
  }

  @Delete()
  async deleteAccount(@Request() req: any) {
    return this.deleteAccountCommand.execute(req.user.sub);
  }
}
