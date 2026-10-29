import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DevOnlyGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(): boolean {
    if (this.config.get('NODE_ENV') !== 'development') {
      throw new ForbiddenException('Dev todo endpoints are development-only');
    }
    return true;
  }
}
