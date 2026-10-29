import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private ses: SESClient;
  private from?: string;

  constructor(private config: ConfigService) {
    this.from = this.config.get<string>('SES_FROM_EMAIL');
    this.ses = new SESClient({
      region: this.config.get<string>('AWS_REGION') || 'ap-southeast-1',
    });
  }

  async sendPasswordReset(to: string, resetUrl: string) {
    if (!this.from) {
      // dev: chưa cấu hình SES thì in link ra log
      this.logger.warn(
        `SES_FROM_EMAIL not set. Reset link for ${to}: ${resetUrl}`,
      );
      return;
    }

    await this.ses.send(
      new SendEmailCommand({
        Source: this.from,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: 'Đặt lại mật khẩu Paper & Progress' },
          Body: {
            Html: {
              Data: `<p>Bạn vừa yêu cầu đặt lại mật khẩu.</p><p><a href="${resetUrl}">Đặt lại mật khẩu</a></p><p>Link có hiệu lực trong 15 phút. Nếu không phải bạn, hãy bỏ qua email này.</p>`,
            },
            Text: { Data: `Đặt lại mật khẩu: ${resetUrl} (hiệu lực 15 phút)` },
          },
        },
      }),
    );
  }
}
