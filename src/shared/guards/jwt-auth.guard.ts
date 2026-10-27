import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private client: jwksClient.JwksClient;

  constructor(private config: ConfigService) {
    this.client = jwksClient({
      jwksUri: this.config.get<string>('JWT_JWKS_URI')!,
      cache: true,
      rateLimit: true,
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid token');
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded?.header.kid) throw new Error('No kid in token');

      const key = await this.client.getSigningKey(decoded.header.kid);
      const publicKey = key.getPublicKey();

      const payload = jwt.verify(token, publicKey, {
        issuer: this.config.get<string>('JWT_ISSUER'),
        //  audience: this.config.get<string>('JWT_AUDIENCE'),
      });

      request.user = payload;
      return true;
    } catch (err: any) {
      console.error('JWT verify error:', err.message);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
