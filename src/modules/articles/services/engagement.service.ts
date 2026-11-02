import { Injectable, NotFoundException } from '@nestjs/common';
import type { ReactionType } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service.js';

const REACTION_TYPES: ReactionType[] = [
  'LIKE',
  'LOVE',
  'INSIGHTFUL',
  'CELEBRATE',
];

/** Reactions and bookmarks. Each is idempotent: pressing twice leaves one row. */
@Injectable()
export class EngagementService {
  constructor(private prisma: PrismaService) {}

  private async requirePublished(articleId: string) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { status: true },
    });
    if (!article || article.status !== 'PUBLISHED') {
      throw new NotFoundException('Không tìm thấy bài viết này.');
    }
  }

  /** Totals for everyone, plus what the signed-in user has already pressed. */
  async summary(articleId: string, userId?: string) {
    const [grouped, mine, bookmark] = await Promise.all([
      this.prisma.reaction.groupBy({
        by: ['type'],
        where: { articleId },
        _count: { _all: true },
      }),
      userId
        ? this.prisma.reaction.findMany({
            where: { articleId, userId },
            select: { type: true },
          })
        : [],
      userId
        ? this.prisma.bookmark.findUnique({
            where: { articleId_userId: { articleId, userId } },
          })
        : null,
    ]);
    const counts = Object.fromEntries(
      REACTION_TYPES.map((type) => [
        type,
        grouped.find((row) => row.type === type)?._count._all ?? 0,
      ]),
    ) as Record<ReactionType, number>;
    return {
      counts,
      mine: mine.map((row) => row.type),
      isBookmarked: bookmark !== null,
    };
  }

  async react(articleId: string, userId: string, type: ReactionType) {
    await this.requirePublished(articleId);
    await this.prisma.reaction.upsert({
      where: { articleId_userId_type: { articleId, userId, type } },
      create: { articleId, userId, type },
      update: {},
    });
    return this.summary(articleId, userId);
  }

  async unreact(articleId: string, userId: string, type: ReactionType) {
    await this.prisma.reaction.deleteMany({
      where: { articleId, userId, type },
    });
    return this.summary(articleId, userId);
  }

  async bookmark(articleId: string, userId: string) {
    await this.requirePublished(articleId);
    await this.prisma.bookmark.upsert({
      where: { articleId_userId: { articleId, userId } },
      create: { articleId, userId },
      update: {},
    });
    return { isBookmarked: true };
  }

  async unbookmark(articleId: string, userId: string) {
    await this.prisma.bookmark.deleteMany({ where: { articleId, userId } });
    return { isBookmarked: false };
  }

  /** The user's saved articles, newest bookmark first. */
  async listBookmarks(userId: string) {
    const rows = await this.prisma.bookmark.findMany({
      where: { userId, article: { status: 'PUBLISHED' } },
      orderBy: { createdAt: 'desc' },
      include: {
        article: {
          select: {
            id: true,
            slug: true,
            title: true,
            excerpt: true,
            coverImageUrl: true,
            readingMinutes: true,
            visibility: true,
            publishedAt: true,
          },
        },
      },
    });
    return rows.map((row) => ({ ...row.article, bookmarkedAt: row.createdAt }));
  }
}
