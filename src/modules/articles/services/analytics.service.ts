import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { REDIS } from './redis.provider.js';

const VIEW_COUNTER = (id: string) => `article:views:${id}`;
const VIEW_PREFIX = 'article:views:';
/** The same visitor opening the same article again within this time is not a new view. */
const DEDUPE_SECONDS = 30 * 60;

export type ArticleStatsSort =
  'views' | 'reactions' | 'bookmarks' | 'completion';

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    @Inject(REDIS) private redis: Redis,
  ) {}

  /**
   * `maxScrollPercent` 0 is "opened", which counts a view (once per visitor per
   * 30 minutes, in Redis); 25/50/75/100 are the milestones the reader passed.
   */
  async recordView(
    articleId: string,
    visitor: { key: string; userId?: string },
    maxScrollPercent: number,
  ) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { status: true },
    });
    if (!article || article.status !== 'PUBLISHED') {
      throw new NotFoundException('Không tìm thấy bài viết này.');
    }
    await this.prisma.articleView.create({
      data: { articleId, userId: visitor.userId, maxScrollPercent },
    });
    if (maxScrollPercent === 0) await this.countView(articleId, visitor.key);
    return { recorded: true };
  }

  private async countView(articleId: string, visitorKey: string) {
    try {
      const isNew = await this.redis.set(
        `viewed:${articleId}:${visitorKey}`,
        '1',
        'EX',
        DEDUPE_SECONDS,
        'NX',
      );
      if (isNew === 'OK') await this.redis.incr(VIEW_COUNTER(articleId));
    } catch {
      // No Redis: count straight in the database, without de-duplication.
      await this.prisma.article.update({
        where: { id: articleId },
        data: { viewCount: { increment: 1 } },
      });
    }
  }

  /** Moves the Redis counters into `Article.viewCount`. A failed write puts the count back. */
  async flushViews(): Promise<number> {
    let flushed = 0;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${VIEW_PREFIX}*`,
          'COUNT',
          100,
        );
        cursor = next;
        for (const key of keys) {
          const raw = await this.redis.getdel(key);
          const count = Number(raw ?? 0);
          if (!count) continue;
          const id = key.slice(VIEW_PREFIX.length);
          try {
            await this.prisma.article.update({
              where: { id },
              data: { viewCount: { increment: count } },
            });
            flushed += count;
          } catch {
            // Deleted article: drop the count. Any other error: keep it for the next run.
            const exists = await this.prisma.article.count({ where: { id } });
            if (exists > 0) await this.redis.incrby(key, count);
          }
        }
      } while (cursor !== '0');
    } catch {
      // Redis is down; the counters are picked up on a later run.
    }
    return flushed;
  }

  /** One row per published article for the admin table. */
  async adminStats(options: {
    sort: ArticleStatsSort;
    direction: 'asc' | 'desc';
    page: number;
    pageSize: number;
  }) {
    const [articles, scroll] = await Promise.all([
      this.prisma.article.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          id: true,
          slug: true,
          title: true,
          publishedAt: true,
          viewCount: true,
          readingMinutes: true,
          _count: {
            select: { reactions: true, bookmarks: true, comments: true },
          },
        },
      }),
      this.prisma.articleView.groupBy({
        by: ['articleId', 'maxScrollPercent'],
        _count: { _all: true },
      }),
    ]);
    const reached = new Map<string, Record<number, number>>();
    for (const row of scroll) {
      const entry = reached.get(row.articleId) ?? {};
      entry[row.maxScrollPercent] = row._count._all;
      reached.set(row.articleId, entry);
    }
    const rows = articles.map((article) => {
      const entry = reached.get(article.id) ?? {};
      const opened = entry[0] ?? 0;
      return {
        id: article.id,
        slug: article.slug,
        title: article.title,
        publishedAt: article.publishedAt,
        readingMinutes: article.readingMinutes,
        views: article.viewCount,
        reactions: article._count.reactions,
        bookmarks: article._count.bookmarks,
        comments: article._count.comments,
        opened,
        reached25: entry[25] ?? 0,
        reached50: entry[50] ?? 0,
        reached75: entry[75] ?? 0,
        reached100: entry[100] ?? 0,
        completionRate: opened > 0 ? (entry[100] ?? 0) / opened : 0,
      };
    });
    const key = {
      views: 'views',
      reactions: 'reactions',
      bookmarks: 'bookmarks',
      completion: 'completionRate',
    }[options.sort] as 'views' | 'reactions' | 'bookmarks' | 'completionRate';
    const sign = options.direction === 'asc' ? 1 : -1;
    rows.sort((a, b) => (a[key] - b[key]) * sign);
    const start = (options.page - 1) * options.pageSize;
    return {
      items: rows.slice(start, start + options.pageSize),
      total: rows.length,
    };
  }
}
