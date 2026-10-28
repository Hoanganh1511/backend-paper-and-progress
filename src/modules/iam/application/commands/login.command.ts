import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export class LoginDto {
  email: string;
  password: string;
}

@Injectable()
export class LoginCommand {
  constructor(private config: ConfigService) {}

  async execute(dto: LoginDto) {
    const tokenUrl = `${this.config.get('KEYCLOAK_BASE_URL')}/realms/${this.config.get('KEYCLOAK_REALM')}/protocol/openid-connect/token`;
    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: this.config.getOrThrow<string>('KEYCLOAK_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('KEYCLOAK_CLIENT_SECRET'),
      username: dto.email,
      password: dto.password,
    });

    try {
      const { data } = await axios.post(tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error('INVALID_CREDENTIALS');
      }
      throw error;
    }
  }
}
