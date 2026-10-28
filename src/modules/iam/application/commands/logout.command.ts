import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export class LogoutDto {
  refreshToken: string;
}

@Injectable()
export class LogoutCommand {
  constructor(private config: ConfigService) {}

  async execute(dto: LogoutDto) {
    const logoutUrl = `${this.config.get('KEYCLOAK_BASE_URL')}/realms/${this.config.get('KEYCLOAK_REALM')}/protocol/openid-connect/logout`;

    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('KEYCLOAK_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('KEYCLOAK_CLIENT_SECRET'),
      refresh_token: dto.refreshToken,
    });

    await axios.post(logoutUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return { message: 'Logged out successfully' };
  }
}
