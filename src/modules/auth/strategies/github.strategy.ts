import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';
import type { SocialProfile } from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GITHUB_CLIENT_ID') || 'not-configured',
      clientSecret:
        config.get<string>('GITHUB_CLIENT_SECRET') || 'not-configured',
      callbackURL:
        config.get<string>('GITHUB_CALLBACK_URL') ||
        'http://localhost:8000/api/v1/auth/github/callback',
      scope: ['user:email'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): SocialProfile {
    return {
      provider: 'github',
      providerAccountId: profile.id,
      email: profile.emails?.[0]?.value ?? null,
      displayName: profile.displayName || profile.username || null,
      avatarUrl: profile.photos?.[0]?.value ?? null,
      accessToken,
      refreshToken,
    };
  }
}
