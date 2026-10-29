import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const MIN_SCORE = 0.5;

interface SiteVerifyResponse {
  success: boolean;
  score?: number;
}

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);

  constructor(private config: ConfigService) {}

  async verify(token?: string | null): Promise<void> {
    const secret = this.config.get<string>('RECAPTCHA_SECRET_KEY');
    // chưa cấu hình secret => bỏ qua để dev không bị block
    if (!secret) return;

    if (!token) throw new BadRequestException('Thiếu mã xác thực reCAPTCHA');

    let data: SiteVerifyResponse;
    try {
      const response = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token }),
        signal: AbortSignal.timeout(3000),
      });
      data = (await response.json()) as SiteVerifyResponse;
    } catch (error) {
      // Google lỗi / timeout -> cho qua, không block user
      this.logger.warn(`reCAPTCHA verify unavailable: ${String(error)}`);
      return;
    }

    if (!data.success || (data.score ?? 0) < MIN_SCORE) {
      throw new BadRequestException('Xác thực reCAPTCHA không thành công');
    }
  }
}
