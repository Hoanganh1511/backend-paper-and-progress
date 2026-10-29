export interface JwtPayload {
  sub: string; // userId
  email: string;
}

export interface SocialProfile {
  provider: 'google' | 'facebook' | 'github';
  providerAccountId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken?: string;
}
