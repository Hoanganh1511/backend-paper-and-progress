/*
Giải thích upsert: Nếu user chưa có → tạo mới. 
Nếu đã có → cập nhật email. Một lệnh duy nhất, không cần if/else.
*/
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { UserRepositoryPort } from '../../domain/ports/user.repository.port.js';
import { UserEntity } from '../../domain/entities/user.entity.js';

@Injectable()
export class UserPrismaRepository implements UserRepositoryPort {
  constructor(private prisma: PrismaService) {}

  async findByKeycloakSub(sub: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { keycloakSub: sub },
    });
    if (!user) return null;
    return Object.assign(new UserEntity(), user);
  }

  async save(user: UserEntity): Promise<UserEntity> {
    const saved = await this.prisma.user.upsert({
      where: { keycloakSub: user.keycloakSub },
      create: {
        keycloakSub: user.keycloakSub,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      update: {
        email: user.email,
      },
    });
    return Object.assign(new UserEntity(), saved);
  }
}
