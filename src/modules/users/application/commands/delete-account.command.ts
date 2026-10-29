import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';

@Injectable()
export class DeleteAccountCommand {
  constructor(private prisma: PrismaService) {}

  // soft delete: giữ dữ liệu, chặn đăng nhập và thu hồi mọi refresh token
  async execute(userId: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);

    return { message: 'Tài khoản đã bị vô hiệu hoá' };
  }
}
