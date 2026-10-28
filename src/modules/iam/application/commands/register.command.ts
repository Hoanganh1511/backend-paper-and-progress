import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export class RegisterDto {
  name: string;
  email: string;
  password: string;
}

@Injectable()
export class RegisterCommand {
  constructor(private config: ConfigService) {}

  async execute(dto: RegisterDto) {
    // 1. get admin token
    const adminToken = await this.getAdminToken();
    const baseUrl = this.config.get('KEYCLOAK_BASE_URL');
    const realm = this.config.get('KEYCLOAK_REALM');

    // Keycloak's default user profile requires lastName, otherwise login fails
    // with "Account is not fully set up"
    const [firstName, ...rest] = dto.name.trim().split(/\s+/);
    const lastName = rest.join(' ') || firstName;

    // 2. create user on keycloak
    try {
      await axios.post(
        `${baseUrl}/admin/realms/${realm}/users`,
        {
          username: dto.email,
          email: dto.email,
          firstName,
          lastName,
          enabled: true,
          emailVerified: false,
          credentials: [
            {
              type: 'password',
              value: dto.password,
              temporary: false,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }

    // 3. Get userID just created
    const { data: users } = await axios.get(
      `${baseUrl}/admin/realms/${realm}/users?username=${dto.email}`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );

    // 4. Send email confirm
    if (users.length > 0) {
      try {
        await axios.put(
          `${baseUrl}/admin/realms/${realm}/users/${users[0].id}/send-verify-email`,
          {},
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );
      } catch {
        // SMTP not configured yet — skip email verification in dev
      }
    }

    return {
      message: 'Registration successful.',
    };
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
