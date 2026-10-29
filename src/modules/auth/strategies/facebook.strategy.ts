import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';
import type { SocialProfile } from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('FACEBOOK_APP_ID') || 'not-configured',
      clientSecret:
        config.get<string>('FACEBOOK_APP_SECRET') || 'not-configured',
      callbackURL:
        config.get<string>('FACEBOOK_CALLBACK_URL') ||
        'http://localhost:8000/api/v1/auth/facebook/callback',
      scope: ['public_profile', 'email'],
      profileFields: ['id', 'emails', 'displayName', 'photos'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): SocialProfile {
    return {
      provider: 'facebook',
      providerAccountId: profile.id,
      email: profile.emails?.[0]?.value ?? null,
      displayName: profile.displayName || null,
      avatarUrl: profile.photos?.[0]?.value ?? null,
      accessToken,
      refreshToken,
    };
  }
}
