import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from './redis.provider.js';

const LIST_PREFIX = 'articles:list:';

/** Caches public article lists in Redis. Every failure just means "not cached". */
@Injectable()
export class ArticleCacheService {
  constructor(@Inject(REDIS) private redis: Redis) {}

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const fullKey = `${LIST_PREFIX}${key}`;
    try {
      const hit = await this.redis.get(fullKey);
      if (hit) return JSON.parse(hit) as T;
    } catch {
      return load();
    }
    const value = await load();
    try {
      await this.redis.set(fullKey, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // not cached, fine
    }
    return value;
  }

  /** Called after a publish, edit or delete. Uses SCAN, never KEYS. */
  async invalidateLists(): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${LIST_PREFIX}*`,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length > 0) await this.redis.del(...keys);
      } while (cursor !== '0');
    } catch {
      // the entries expire by themselves within a minute
    }
  }
}
