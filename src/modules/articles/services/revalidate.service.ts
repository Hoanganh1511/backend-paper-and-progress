import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Tells the web app to rebuild the static pages of an article. The secret goes in a header, not the URL. */
@Injectable()
export class RevalidateService {
  private readonly logger = new Logger(RevalidateService.name);

  constructor(private config: ConfigService) {}

  async revalidate(slug?: string): Promise<void> {
    const secret = this.config.get<string>('REVALIDATE_SECRET');
    if (!secret) return;
    const base = this.config.get<string>('FRONTEND_URL');
    try {
      await fetch(`${base}/api/revalidate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': secret,
        },
        body: JSON.stringify({ slug }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      this.logger.warn(`Revalidate failed: ${String(error)}`);
    }
  }
}
