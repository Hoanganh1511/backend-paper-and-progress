import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { LocalAuthGuard } from './guards/local-auth.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard.js';
import { GoogleAuthGuard } from './guards/google-auth.guard.js';
import { FacebookAuthGuard } from './guards/facebook-auth.guard.js';
import { GithubAuthGuard } from './guards/github-auth.guard.js';
import { RegisterDto } from './dtos/register.dto.js';
import { LoginDto } from './dtos/login.dto.js';
import { RefreshTokenDto } from './dtos/refresh-token.dto.js';
import { ForgotPasswordDto } from './dtos/forgot-password.dto.js';
import { ResetPasswordDto } from './dtos/reset-password.dto.js';
import type { SocialProfile } from './interfaces/jwt-payload.interface.js';
import { LoginHistoryService } from './services/login-history.service.js';

interface SocialRequest {
  user: SocialProfile;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

const getUserAgent = (req: {
  headers: Record<string, string | string[] | undefined>;
}) => {
  const ua = req.headers['user-agent'];
  return (Array.isArray(ua) ? ua[0] : ua) ?? 'unknown';
};

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
    private loginHistoryService: LoginHistoryService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // LoginDto dùng để validate body; việc xác thực do LocalAuthGuard làm
  @Post('login')
  @HttpCode(200)
  @UseGuards(LocalAuthGuard)
  login(
    @Req()
    req: {
      user: { id: string; email: string };
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    },
    @Body() _dto: LoginDto,
  ) {
    const ip =
      req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
    return this.authService.login(req.user, ip, getUserAgent(req));
  }
  @Get('login-history')
  @UseGuards(JwtAuthGuard)
  async getLoginHistory(@Req() req: { user: { id: string } }) {
    return this.loginHistoryService.getHistory(req.user.id);
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(JwtRefreshGuard)
  refresh(@Req() req: { user: { sub: string } }, @Body() dto: RefreshTokenDto) {
    return this.authService.refresh(req.user.sub, dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: { sub: string } }) {
    return this.authService.me(req.user.sub);
  }

  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  // ───────── Social: redirect flow ─────────

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  google() {
    // GoogleAuthGuard redirect sang Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleCallback(@Req() req: SocialRequest, @Res() res: Response) {
    return this.finishSocialLogin(req, res);
  }

  @Get('facebook')
  @UseGuards(FacebookAuthGuard)
  facebook() {
    // FacebookAuthGuard redirect sang Facebook
  }

  @Get('facebook/callback')
  @UseGuards(FacebookAuthGuard)
  facebookCallback(@Req() req: SocialRequest, @Res() res: Response) {
    return this.finishSocialLogin(req, res);
  }

  @Get('github')
  @UseGuards(GithubAuthGuard)
  github() {
    // GithubAuthGuard redirect sang GitHub
  }

  @Get('github/callback')
  @UseGuards(GithubAuthGuard)
  githubCallback(@Req() req: SocialRequest, @Res() res: Response) {
    return this.finishSocialLogin(req, res);
  }

  private async finishSocialLogin(req: SocialRequest, res: Response) {
    const callbackUrl = `${this.config.get('FRONTEND_URL')}/auth/callback`;
    try {
      const { accessToken, refreshToken } = await this.authService.socialLogin(
        req.user,
        req.ip ?? 'unknown',
        getUserAgent(req),
      );
      const query = new URLSearchParams({ accessToken, refreshToken });
      return res.redirect(`${callbackUrl}?${query}`);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'LOGIN_FAILED';
      return res.redirect(`${callbackUrl}?error=${encodeURIComponent(code)}`);
    }
  }
}
