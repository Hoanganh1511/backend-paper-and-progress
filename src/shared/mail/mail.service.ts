import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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

  async sendLoginAlert(
    to: string,
    info: { ip: string; userAgent: string; at: Date },
  ) {
    const time = info.at.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });

    if (!this.from) {
      // dev: chưa cấu hình SES thì chỉ in ra log
      this.logger.warn(
        `SES_FROM_EMAIL not set. Login alert for ${to}: IP=${info.ip}, UA=${info.userAgent}, at ${time}`,
      );
      return;
    }

    // userAgent do client gửi lên => phải escape trước khi nhúng vào HTML
    const ip = escapeHtml(info.ip);
    const userAgent = escapeHtml(info.userAgent);

    await this.ses.send(
      new SendEmailCommand({
        Source: this.from,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: {
            Data: 'Đăng nhập mới từ thiết bị lạ - Paper & Progress',
          },
          Body: {
            Html: {
              Data: `<p>Tài khoản <b>${escapeHtml(to)}</b> vừa đăng nhập từ một thiết bị lạ.</p><ul><li>IP: ${ip}</li><li>Thiết bị: ${userAgent}</li><li>Thời gian: ${time}</li></ul><p>Nếu là bạn, hãy bỏ qua email này. Nếu không phải bạn, hãy đổi mật khẩu ngay.</p>`,
            },
            Text: {
              Data: `Tài khoản ${to} vừa đăng nhập từ IP: ${info.ip}, thiết bị: ${info.userAgent}, lúc: ${time}. Nếu không phải bạn, hãy đổi mật khẩu ngay.`,
            },
          },
        },
      }),
    );
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
