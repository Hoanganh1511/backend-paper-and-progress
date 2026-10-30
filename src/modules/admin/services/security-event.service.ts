import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service.js';

export const SECURITY_EVENT_TYPES = [
  'RECAPTCHA_REJECT',
  'HIBP_BLOCK',
  'TOTP_FAIL',
  'RECOVERY_USED',
  'ANOMALY_ALERT',
] as const;

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

@Injectable()
export class SecurityEventService {
  private readonly logger = new Logger(SecurityEventService.name);

  constructor(private prisma: PrismaService) {}

  // Không bao giờ throw: lỗi ghi log bảo mật không được làm hỏng luồng auth
  async log(
    type: SecurityEventType,
    userId?: string | null,
    ip?: string | null,
    metadata?: Prisma.InputJsonValue,
  ): Promise<void> {
    try {
      await this.prisma.securityEvent.create({
        data: {
          type,
          userId: userId ?? null,
          ip: ip ?? null,
          metadata,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log security event ${type}`, error);
    }
  }
}
