import { BadRequestException, Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { PasswordCheckService } from '../../../auth/services/password-check.service.js';
import { ChangePasswordDto } from '../dtos/change-password.dto.js';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class ChangePasswordCommand {
  constructor(
    private prisma: PrismaService,
    private passwordCheckService: PasswordCheckService,
  ) {}

  async execute(userId: string, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Tài khoản không tồn tại');

    if (!user.password) {
      throw new BadRequestException(
        'Tài khoản đăng nhập bằng mạng xã hội chưa có mật khẩu, hãy dùng "Quên mật khẩu"',
      );
    }

    const matches = await bcrypt.compare(dto.currentPassword, user.password);
    if (!matches) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    const { pwned, count } = await this.passwordCheckService.isPasswordPwned(
      dto.newPassword,
    );
    if (pwned) {
      throw new BadRequestException(
        `Mật khẩu này đã xuất hiện trong ${count.toLocaleString()} vụ rò rỉ dữ liệu. Vui lòng chọn mật khẩu khác.`,
      );
    }

    // đổi mật khẩu xong thì thu hồi mọi refresh token (đăng xuất các thiết bị)
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { password: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);

    return { message: 'Đổi mật khẩu thành công' };
  }
}
