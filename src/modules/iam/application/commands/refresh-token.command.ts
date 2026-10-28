import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export class RefreshTokenDto {
  refreshToken: string;
}

@Injectable()
export class RefreshTokenCommand {
  constructor(private config: ConfigService) {}

  async execute(dto: RefreshTokenDto) {
    const tokenUrl = `${this.config.get('KEYCLOAK_BASE_URL')}/realms/${this.config.get('KEYCLOAK_REALM')}/protocol/openid-connect/token`;

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.getOrThrow<string>('KEYCLOAK_CLIENT_ID'),
      client_secret: this.config.getOrThrow('KEYCLOAK_CLIENT_SECRET'),
      refresh_token: dto.refreshToken,
    });

    const { data } = await axios.post(tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }
}
