import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class PasswordCheckService {
  // Hash SHA-1 rồi tách prefix/suffix
  private hashPassword(password: string): { prefix: string; suffix: string } {
    const hash = crypto
      .createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();

    return {
      prefix: hash.substring(0, 5),
      suffix: hash.substring(5),
    };
  }

  // Gọi HIBP API Kiểm tra
  async isPasswordPwned(
    password: string,
  ): Promise<{ pwned: boolean; count: number }> {
    const { prefix, suffix } = this.hashPassword(password);

    let text: string;
    try {
      const response = await fetch(
        `https://api.pwnedpasswords.com/range/${prefix}`,
        {
          headers: { 'User-Agent': 'Paper-And-Progress' },
          signal: AbortSignal.timeout(3000),
        },
      );

      if (!response.ok) {
        // API loi~ -> cho qua, khong block user
        return { pwned: false, count: 0 };
      }
      text = await response.text();
    } catch {
      // timeout / mat mang -> cho qua, khong block user
      return { pwned: false, count: 0 };
    }

    const lines = text.split('\n');

    for (const line of lines) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix.trim() === suffix) {
        return { pwned: true, count: parseInt(count.trim(), 10) };
      }
    }
    return { pwned: false, count: 0 };
  }
}
