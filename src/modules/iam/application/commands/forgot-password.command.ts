import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export class ForgotPasswordDto {
  email: string;
}

@Injectable()
export class ForgotPasswordCommand {
  private readonly logger = new Logger(ForgotPasswordCommand.name);

  constructor(private config: ConfigService) {}

  async execute(dto: ForgotPasswordDto) {
    try {
      await this.sendResetEmail(dto.email);
    } catch (error) {
      // Never surface failures: the response must be identical whether or not
      // the email exists, so SMTP / Keycloak errors are only logged.
      this.logger.error(
        'Failed to send password reset email',
        error instanceof Error ? error.stack : undefined,
      );
    }

    return { message: 'If the email exists, a reset link has been sent' };
  }

  private async sendResetEmail(email: string) {
    const baseUrl = this.config.get('KEYCLOAK_BASE_URL');
    const realm = this.config.get('KEYCLOAK_REALM');
    const adminToken = await this.getAdminToken();
    const headers = { Authorization: `Bearer ${adminToken}` };

    const { data: users } = await axios.get(
      `${baseUrl}/admin/realms/${realm}/users`,
      { params: { email, exact: true }, headers },
    );
    if (users.length === 0) return;

    await axios.put(
      `${baseUrl}/admin/realms/${realm}/users/${users[0].id}/execute-actions-email`,
      ['UPDATE_PASSWORD'],
      { headers },
    );
  }

  private async getAdminToken(): Promise<string> {
    const baseUrl = this.config.get('KEYCLOAK_BASE_URL');
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.getOrThrow<string>('KEYCLOAK_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('KEYCLOAK_CLIENT_SECRET'),
    });

    const { data } = await axios.post(
      `${baseUrl}/realms/${this.config.get('KEYCLOAK_REALM')}/protocol/openid-connect/token`,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    return data.access_token;
  }
}
