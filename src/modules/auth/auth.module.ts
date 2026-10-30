import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LocalStrategy } from './strategies/local.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { FacebookStrategy } from './strategies/facebook.strategy.js';
import { GithubStrategy } from './strategies/github.strategy.js';
import { MailModule } from '../../shared/mail/mail.module.js';
import { PasswordCheckService } from './services/password-check.service.js';
import { RecaptchaService } from './services/recaptcha.service.js';
import { CryptoService } from './services/crypto.service.js';
import { TotpService } from './services/totp.service.js';
import { TotpController } from './totp.controller.js';
import { LoginHistoryService } from './services/login-history.service.js';

@Module({
  imports: [PassportModule, JwtModule.register({}), MailModule],
  controllers: [AuthController, TotpController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
    GoogleStrategy,
    FacebookStrategy,
    GithubStrategy,
    PasswordCheckService,
    RecaptchaService,
    LoginHistoryService,
    CryptoService,
    TotpService,
  ],
  exports: [AuthService, PasswordCheckService],
})
export class AuthModule {}
