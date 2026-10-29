import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../shared/database/prisma.service.js';
import { MailService } from '../../shared/mail/mail.service.js';
import type {
  JwtPayload,
  SocialProfile,
} from './interfaces/jwt-payload.interface.js';
import type { RegisterDto } from './dtos/register.dto.js';

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_EXPIRATION = '15m';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mail: MailService,
  ) {}

  // ───────── Email / password ─────────

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email đã được sử dụng');

    const user = await this.prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        displayName: dto.displayName,
        profile: { create: { displayName: dto.displayName } },
      },
    });
    return this.toPublicUser(user);
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user?.password || !user.isActive) return null;
    const ok = await bcrypt.compare(password, user.password);
    return ok ? user : null;
  }

  login(user: { id: string; email: string }) {
    return this.issueTokens(user.id, user.email);
  }

  async refresh(userId: string, rawRefreshToken: string) {
    // xoá token cũ (rotation); count = 0 nghĩa là token đã dùng/đã thu hồi
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: {
        token: sha256(rawRefreshToken),
        userId,
        expiresAt: { gt: new Date() },
      },
    });
    if (count === 0) throw new UnauthorizedException('Invalid refresh token');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isActive) throw new UnauthorizedException('Account disabled');

    return this.issueTokens(user.id, user.email);
  }

  async logout(rawRefreshToken: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { token: sha256(rawRefreshToken) },
    });
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isActive) throw new UnauthorizedException();
    return this.toPublicUser(user);
  }

  // ───────── Forgot / reset password ─────────

  async forgotPassword(emailInput: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: emailInput.toLowerCase() },
    });

    // luôn trả cùng một kết quả để không lộ email nào đã đăng ký
    if (user?.isActive) {
      const token = this.jwt.sign(
        { sub: user.id, purpose: 'reset-password' },
        {
          secret: this.resetSecret(user.password),
          expiresIn: RESET_TOKEN_EXPIRATION,
        },
      );
      const url = `${this.config.get('FRONTEND_URL')}/reset-password?token=${token}`;
      try {
        await this.mail.sendPasswordReset(user.email, url);
      } catch (error) {
        this.logger.error('Send reset email failed', error);
      }
    }
    return { message: 'Nếu email tồn tại, link đặt lại mật khẩu đã được gửi' };
  }

  async resetPassword(token: string, newPassword: string) {
    const invalid = new BadRequestException(
      'Token không hợp lệ hoặc đã hết hạn',
    );

    const decoded = this.jwt.decode<{ sub?: string } | null>(token);
    if (!decoded?.sub) throw invalid;

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
    });
    if (!user?.isActive) throw invalid;

    try {
      // secret chứa hash mật khẩu hiện tại => token chỉ dùng được 1 lần
      const payload = this.jwt.verify<{ purpose?: string }>(token, {
        secret: this.resetSecret(user.password),
      });
      if (payload.purpose !== 'reset-password') throw invalid;
    } catch {
      throw invalid;
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);
    return { message: 'Đặt lại mật khẩu thành công' };
  }

  // ───────── Social login ─────────

  async socialLogin(profile: SocialProfile) {
    if (!profile.email) throw new Error('EMAIL_REQUIRED');
    const email = profile.email.toLowerCase();

    const accountKey = {
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
    };
    const accountData = {
      accessToken: profile.accessToken,
      refreshToken: profile.refreshToken,
    };

    const linked = await this.prisma.account.findUnique({
      where: { provider_providerAccountId: accountKey },
      include: { user: true },
    });

    let user = linked?.user ?? null;
    if (linked) {
      await this.prisma.account.update({
        where: { id: linked.id },
        data: accountData,
      });
    } else {
      user = await this.prisma.user.findUnique({ where: { email } });
      if (user) {
        await this.prisma.account.create({
          data: { ...accountKey, ...accountData, userId: user.id },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            profile: { create: { displayName: profile.displayName } },
            accounts: { create: { ...accountKey, ...accountData } },
          },
        });
      }
    }

    if (!user?.isActive) throw new Error('ACCOUNT_DISABLED');
    return this.issueTokens(user.id, user.email);
  }

  // ───────── Helpers ─────────

  private async issueTokens(userId: string, email: string) {
    const payload: JwtPayload = { sub: userId, email };
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_ACCESS_EXPIRATION',
      ) as JwtSignOptions['expiresIn'],
    });
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_REFRESH_EXPIRATION',
      ) as JwtSignOptions['expiresIn'],
      jwtid: randomUUID(), // để 2 token cấp cùng giây vẫn khác nhau
    });

    const { exp } = this.jwt.decode<{ exp: number }>(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        token: sha256(refreshToken),
        userId,
        expiresAt: new Date(exp * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private resetSecret(passwordHash: string | null) {
    return (
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET') + (passwordHash ?? '')
    );
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;
  }) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
    };
  }
}
