import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';

@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(_exception: ThrottlerException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    // ThrottlerGuard sets Retry-After (seconds) before throwing
    const retryAfter = Number(response.getHeader('Retry-After')) || 0;

    response.status(429).json({
      statusCode: 429,
      message: 'Too many requests',
      retryAfter,
    });
  }
}
