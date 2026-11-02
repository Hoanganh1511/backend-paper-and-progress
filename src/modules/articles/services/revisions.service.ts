import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service.js';

export const MAX_REVISIONS = 50;
/** Saves by the same person closer together than this overwrite the last revision. */
export const MERGE_WINDOW_MS = 2 * 60 * 1000;

export interface RevisionSnapshot {
  title: string;
  contentJson: Prisma.InputJsonValue;
  contentHtml: string;
  contentText: string;
}

@Injectable()
export class RevisionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Records the article's content. With `merge` (auto-save), a revision by the
   * same person from the last two minutes is overwritten instead of adding one.
   */
  async record(
    articleId: string,
    userId: string,
    snapshot: RevisionSnapshot,
    options: { merge?: boolean; now?: Date } = {},
  ) {
    const now = options.now ?? new Date();
    if (options.merge) {
      const last = await this.prisma.articleRevision.findFirst({
        where: { articleId },
        orderBy: { createdAt: 'desc' },
      });
      if (
        last &&
        last.createdById === userId &&
        now.getTime() - last.createdAt.getTime() < MERGE_WINDOW_MS
      ) {
        return this.prisma.articleRevision.update({
          where: { id: last.id },
          data: snapshot,
        });
      }
    }
    const created = await this.prisma.articleRevision.create({
      data: { articleId, createdById: userId, ...snapshot },
    });
    await this.prune(articleId);
    return created;
  }

  /** Keeps the newest MAX_REVISIONS. */
  private async prune(articleId: string) {
    const old = await this.prisma.articleRevision.findMany({
      where: { articleId },
      orderBy: { createdAt: 'desc' },
      skip: MAX_REVISIONS,
      select: { id: true },
    });
    if (old.length > 0) {
      await this.prisma.articleRevision.deleteMany({
        where: { id: { in: old.map((row) => row.id) } },
      });
    }
  }

  list(articleId: string) {
    return this.prisma.articleRevision.findMany({
      where: { articleId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, contentText: true, createdAt: true },
    });
  }

  async get(articleId: string, revisionId: string) {
    const revision = await this.prisma.articleRevision.findFirst({
      where: { id: revisionId, articleId },
    });
    if (!revision) throw new NotFoundException('Không tìm thấy phiên bản này.');
    return revision;
  }
}
