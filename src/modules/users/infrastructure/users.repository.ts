import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';

@Injectable()
export class UserProfileRepository {
  constructor(private prisma: PrismaService) {}

  async findByUserId(userId: string) {
    return this.prisma.userProfile.findUnique({
      where: { userId },
    });
  }

  async upsert(
    userId: string,
    data: Partial<{
      displayName: string;
      bio: string;
      phone: string;
      avatarBase64: string | null;
      timezone: string;
      locale: string;
      theme: string;
    }>,
  ) {
    return this.prisma.userProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }
}
