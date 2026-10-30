import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { CryptoService } from './crypto.service.js';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import bcrypt from 'bcrypt';
import { SecurityEventService } from '../../admin/services/security-event.service.js';

@Injectable()
export class TotpService {
  constructor(
    private prisma: PrismaService,
    private cryptoService: CryptoService,
    private securityEvents: SecurityEventService,
  ) {}

  async setup(userId: string) {
    const existing = await this.prisma.userTotp.findUnique({
      where: { userId },
    });
    if (existing?.enabled) {
      throw new BadRequestException(
        '2FA đã được bật. Hãy tắt trước khi setup lại',
      );
    }

    if (existing) {
      await this.prisma.userTotp.delete({
        where: { userId },
      });
    }

    const secret = generateSecret();
    const secretEnc = this.cryptoService.encrypt(secret);

    await this.prisma.userTotp.create({
      data: { userId, secretEnc, enabled: false },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new BadRequestException('User không tồn tại.');

    const otpauthUrl = generateURI({
      secret,
      label: user.email,
      issuer: 'Paper & Progress',
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return { qrCode: qrCodeDataUrl, secret, otpauthUrl };
  }

  async verifyAndEnable(userId: string, code: string) {
    const totp = await this.prisma.userTotp.findUnique({ where: { userId } });
    if (!totp) throw new BadRequestException('Chưa setup 2FA.');
    if (totp.enabled) throw new BadRequestException('2FA đã được bật.');

    const secret = this.cryptoService.decrypt(totp.secretEnc);
    const result = verifySync({ token: code, secret, epochTolerance: 30 });
    if (!result.valid || !('timeStep' in result))
      throw new BadRequestException('Mã không đúng. Vui lòng thử lại.');

    await this.prisma.userTotp.update({
      where: { userId },
      data: {
        enabled: true,
        enabledAt: new Date(),
        lastUsedStep: result.timeStep,
      },
    });

    const recoveryCodes = await this.generateRecoveryCodes(totp.id);
    return { recoveryCodes }; // Trả plaintext 1 lần duy nhất
  }

  // VERIFY: kiểm tra code khi login
  async verify(userId: string, code: string, ip?: string): Promise<boolean> {
    const ok = await this.checkTotp(userId, code);
    if (!ok) await this.securityEvents.log('TOTP_FAIL', userId, ip);
    return ok;
  }

  // TOTP hoặc recovery code; chỉ ghi TOTP_FAIL khi cả hai đều sai
  async verifyCodeOrRecovery(
    userId: string,
    code: string,
    ip?: string,
  ): Promise<boolean> {
    if (await this.checkTotp(userId, code)) return true;
    if (await this.verifyRecoveryCode(userId, code, ip)) return true;
    await this.securityEvents.log('TOTP_FAIL', userId, ip);
    return false;
  }

  private async checkTotp(userId: string, code: string): Promise<boolean> {
    const totp = await this.prisma.userTotp.findUnique({ where: { userId } });
    if (!totp?.enabled) throw new BadRequestException('2FA chưa được bật.');

    const secret = this.cryptoService.decrypt(totp.secretEnc);
    const result = verifySync({
      token: code,
      secret,
      epochTolerance: 30,
      afterTimeStep: totp.lastUsedStep ?? undefined,
    });
    if (!result.valid || !('timeStep' in result)) return false;

    // Atomic update chặn replay: chỉ thành công nếu timeStep mới hơn lastUsedStep
    const { count } = await this.prisma.userTotp.updateMany({
      where: {
        userId,
        OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: result.timeStep } }],
      },
      data: { lastUsedStep: result.timeStep },
    });
    return count === 1;
  }

  async verifyRecoveryCode(
    userId: string,
    code: string,
    ip?: string,
  ): Promise<boolean> {
    const totp = await this.prisma.userTotp.findUnique({ where: { userId } });
    if (!totp?.enabled) return false;

    const codeHash = crypto
      .createHash('sha256')
      .update(code.trim().toLowerCase())
      .digest('hex');

    // Atomic: chỉ 1 request thắng khi dùng song song cùng 1 recovery code
    const { count } = await this.prisma.recoveryCode.updateMany({
      where: { totpId: totp.id, codeHash, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 1) await this.securityEvents.log('RECOVERY_USED', userId, ip);
    return count === 1;
  }

  async isEnabled(userId: string): Promise<boolean> {
    const totp = await this.prisma.userTotp.findUnique({ where: { userId } });
    return totp?.enabled ?? false;
  }

  async disable(userId: string, code: string, password?: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User không tồn tại.');

    // User đăng ký qua social có password = null thì chỉ cần code
    if (user.password) {
      const ok = password && (await bcrypt.compare(password, user.password));
      if (!ok) throw new UnauthorizedException('Mật khẩu không đúng.');
    }

    const valid = await this.verifyCodeOrRecovery(userId, code, ip);
    if (!valid) throw new UnauthorizedException('Mã không đúng.');

    await this.prisma.userTotp.delete({ where: { userId } });
  }

  async regenerateRecoveryCodes(userId: string, code: string, ip?: string) {
    if (!(await this.verify(userId, code, ip)))
      throw new UnauthorizedException('Mã không đúng.');

    const totp = await this.prisma.userTotp.findUnique({ where: { userId } });
    if (!totp) throw new BadRequestException('Chưa setup 2FA.');
    return { recoveryCodes: await this.generateRecoveryCodes(totp.id) };
  }

  private async generateRecoveryCodes(totpId: string, count = 10) {
    const codes = Array.from({ length: count }, () =>
      crypto.randomBytes(5).toString('hex'),
    );
    await this.prisma.recoveryCode.deleteMany({ where: { totpId } });
    await this.prisma.recoveryCode.createMany({
      data: codes.map((code) => ({
        totpId,
        codeHash: crypto.createHash('sha256').update(code).digest('hex'),
      })),
    });
    return codes;
  }
}
