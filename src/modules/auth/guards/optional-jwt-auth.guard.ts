import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Lets a request through without a token (`req.user` stays empty), and fills
 * `req.user` when a valid one is sent. For endpoints that serve guests and members.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(
    _error: unknown,
    user: TUser | false,
  ): TUser | undefined {
    return user || undefined;
  }
}
