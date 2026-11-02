import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { MembershipSource } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service.js';

export interface MembershipStatus {
  isMember: boolean;
  expiresAt: Date | null;
  source: MembershipSource | null;
}

/**
 * Who is a member. Membership is one row per user with an end date; someone is a
 * member while that date is still ahead. How the row gets there (an admin, later
 * a payment) is the caller's business.
 */
@Injectable()
export class MembershipService {
  constructor(private prisma: PrismaService) {}

  async get(userId: string): Promise<MembershipStatus> {
    const row = await this.prisma.membership.findUnique({
      where: { userId },
      select: { expiresAt: true, source: true },
    });
    if (!row) return { isMember: false, expiresAt: null, source: null };
    return {
      isMember: row.expiresAt.getTime() > Date.now(),
      expiresAt: row.expiresAt,
      source: row.source,
    };
  }

  async isMember(userId: string): Promise<boolean> {
    return (await this.get(userId)).isMember;
  }

  /** Sets the end date (extending or shortening); the date has to be in the future. */
  async grant(
    userId: string,
    expiresAt: Date,
    source: MembershipSource = 'ADMIN',
  ) {
    if (
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Ngày hết hạn phải ở tương lai.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User không tồn tại');
    await this.prisma.membership.upsert({
      where: { userId },
      create: { userId, expiresAt, source },
      update: { expiresAt, source },
    });
    return this.get(userId);
  }

  async revoke(userId: string) {
    await this.prisma.membership.deleteMany({ where: { userId } });
    return this.get(userId);
  }
}
