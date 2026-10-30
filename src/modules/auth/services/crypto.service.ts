import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly key: Buffer;
  constructor(private configService: ConfigService) {
    this.key = Buffer.from(
      this.configService.getOrThrow<string>('TOTP_ENC_KEY'),
      'base64',
    );
  }

  //Ecrypt: trả về string format "iv:tag:ciphertext" (hex)
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12); //96-bit IV cho GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  }

  //Decrypt: nhận string format "iv:tag:ciphertext"
  decrypt(encryptedData: string): string {
    const [ivHex, tagHex, ciphertext] = encryptedData.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
