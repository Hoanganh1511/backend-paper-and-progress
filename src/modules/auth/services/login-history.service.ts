import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { MailService } from '../../../shared/mail/mail.service.js';
@Injectable()
export class LoginHistoryService {
  private readonly logger = new Logger(LoginHistoryService.name);
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async recordLogin(
    userId: string,
    ip: string,
    userAgent: string,
  ): Promise<void> {
    // skip localhost when dev
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
      await this.prisma.loginHistory.create({
        data: {
          userId,
          ip,
          userAgent,
        },
      });
      return;
    }

    // check IP is logged in
    const knownIp = await this.prisma.loginHistory.findFirst({
      where: { userId, ip },
    });

    // Save new record
    await this.prisma.loginHistory.create({
      data: { userId, ip, userAgent },
    });

    // new strange IP + has history -> Alert
    if (!knownIp) {
      const hasHistory = await this.prisma.loginHistory.count({
        where: { userId },
      });

      // hasHistory > 1 because just create 1 record above
      if (hasHistory > 1) {
        this.sendAlertEmail(userId, ip, userAgent).catch((err) =>
          this.logger.error('Failed to send login alert email', err),
        );
      }
    }
  }
  private async sendAlertEmail(
    userId: string,
    ip: string,
    userAgent: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) return;

    this.logger.warn(
      `New login from unknown IP for user ${user.email}: IP=${ip}, UA=${userAgent}`,
    );

    await this.mail.sendLoginAlert(user.email, {
      ip,
      userAgent,
      at: new Date(),
    });
  }

  async getHistory(userId: string, limit = 20) {
    return this.prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, ip: true, userAgent: true, createdAt: true },
    });
  }
}
