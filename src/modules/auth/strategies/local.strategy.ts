import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service.js';
import { RecaptchaService } from '../services/recaptcha.service.js';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private recaptchaService: RecaptchaService,
  ) {
    super({ usernameField: 'email', passReqToCallback: true });
  }

  async validate(
    req: { body?: { recaptchaToken?: string } },
    email: string,
    password: string,
  ) {
    // verify reCAPTCHA trước khi động đến credentials
    await this.recaptchaService.verify(req.body?.recaptchaToken);

    const user = await this.authService.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    return user;
  }
}
