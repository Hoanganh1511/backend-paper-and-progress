import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type Role } from '@prisma/client';
import slugify from 'slugify';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import type {
  CreateArticleInput,
  ListArticlesInput,
  UpdateArticleInput,
} from '../articles.schema.js';
import { ArticleCacheService } from './article-cache.service.js';
import { MembershipService } from '../../membership/membership.service.js';
import { ContentService } from './content.service.js';
import { RevalidateService } from './revalidate.service.js';
import { RevisionsService } from './revisions.service.js';

export interface Viewer {
  sub: string;
  role?: Role;
}

const LIST_TTL_SECONDS = 60;

/** Slugs the web app uses for its own pages under /articles. */
const RESERVED_SLUGS = new Set(['new', 'saved', 'mine', 'tags', 'series']);

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImageUrl: true,
  readingMinutes: true,
  visibility: true,
  status: true,
  publishedAt: true,
  viewCount: true,
  seriesOrder: true,
  author: { select: { id: true, displayName: true } },
  articleType: true,
  tags: { select: { tag: { select: { name: true, slug: true } } } },
  topics: { select: { topic: { select: { name: true, slug: true } } } },
  series: { select: { title: true, slug: true } },
} satisfies Prisma.ArticleSelect;

type CardRow = Prisma.ArticleGetPayload<{ select: typeof cardSelect }>;

/** Tags come back as `{ tag: {...} }` rows from the join table; the API flattens them. */
const toCard = <
  T extends { tags: CardRow['tags']; topics: CardRow['topics'] },
>({
  tags,
  topics,
  ...rest
}: T) => ({
  ...rest,
  tags: tags.map((row) => row.tag),
  topics: topics.map((row) => row.topic),
});

const canManage = (article: { authorId: string }, viewer?: Viewer) =>
  Boolean(
    viewer && (viewer.role === 'ADMIN' || viewer.sub === article.authorId),
  );

const encodeCursor = (publishedAt: Date, id: string) =>
  Buffer.from(`${publishedAt.toISOString()}|${id}`).toString('base64url');

function decodeCursor(cursor: string): { at: Date; id: string } | undefined {
  const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const date = new Date(at);
  return id && !Number.isNaN(date.getTime()) ? { at: date, id } : undefined;
}

@Injectable()
export class ArticlesService {
  constructor(
    private prisma: PrismaService,
    private content: ContentService,
    private revisions: RevisionsService,
    private cache: ArticleCacheService,
    private revalidator: RevalidateService,
    private membership: MembershipService,
  ) {}

  /* ------------------------------------------------------------------------ */
  /* Reading                                                                  */
  /* ------------------------------------------------------------------------ */

  /** Published articles, newest first. Cached for a minute; cleared on every write. */
  list(query: ListArticlesInput) {
    return this.cache.getOrSet(JSON.stringify(query), LIST_TTL_SECONDS, () =>
      query.q ? this.search(query) : this.page(query),
    );
  }

  private publishedWhere(query: ListArticlesInput): Prisma.ArticleWhereInput {
    return {
      status: 'PUBLISHED',
      ...(query.tag ? { tags: { some: { tag: { slug: query.tag } } } } : {}),
      ...(query.topic
        ? { topics: { some: { topic: { slug: query.topic } } } }
        : {}),
      ...(query.type ? { articleType: query.type } : {}),
      ...(query.series ? { series: { slug: query.series } } : {}),
    };
  }

  private async page(query: ListArticlesInput) {
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const rows = await this.prisma.article.findMany({
      where: {
        ...this.publishedWhere(query),
        ...(cursor
          ? {
              OR: [
                { publishedAt: { lt: cursor.at } },
                { publishedAt: cursor.at, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: cardSelect,
    });
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items: items.map(toCard),
      nextCursor:
        rows.length > query.limit && last?.publishedAt
          ? encodeCursor(last.publishedAt, last.id)
          : null,
    };
  }

  /** Full-text search ranked by relevance; the cursor is the offset. */
  private async search(query: ListArticlesInput) {
    const offset = Number(query.cursor ?? 0) || 0;
    const q = query.q ?? '';
    const ids = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Article"
      WHERE status = 'PUBLISHED'
        AND "searchVector" @@ websearch_to_tsquery('simple', ${q})
      ORDER BY ts_rank("searchVector", websearch_to_tsquery('simple', ${q})) DESC, id
      OFFSET ${offset} LIMIT ${query.limit + 1}`;
    const pageIds = ids.slice(0, query.limit).map((row) => row.id);
    const rows = await this.prisma.article.findMany({
      where: { id: { in: pageIds }, ...this.publishedWhere(query) },
      select: cardSelect,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return {
      items: pageIds.flatMap((id) => {
        const row = byId.get(id);
        return row ? [toCard(row)] : [];
      }),
      nextCursor:
        ids.length > query.limit ? String(offset + query.limit) : null,
    };
  }

  /**
   * The article page. Draft, scheduled and archived articles exist only for the
   * author and admins (404 for everyone else, so their existence is not leaked).
   */
  async getBySlug(slug: string, viewer?: Viewer) {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      select: {
        ...cardSelect,
        authorId: true,
        contentHtml: true,
        scheduledAt: true,
        updatedAt: true,
        series: {
          select: {
            title: true,
            slug: true,
            articles: {
              where: { status: 'PUBLISHED' },
              orderBy: { seriesOrder: 'asc' },
              select: { slug: true, title: true, seriesOrder: true },
            },
          },
        },
      },
    });
    const isManager = article ? canManage(article, viewer) : false;
    if (!article || (article.status !== 'PUBLISHED' && !isManager)) {
      throw new NotFoundException('Không tìm thấy bài viết này.');
    }

    const { contentHtml, ...rest } = article;
    const meta = { ...toCard(rest), related: await this.related(article) };

    // Only members read a limited article in full (its author and admins too).
    // Signing in is not enough; `reason` tells the page which prompt to show.
    const isMember =
      !isManager && article.visibility !== 'PUBLIC' && viewer
        ? await this.membership.isMember(viewer.sub)
        : false;
    if (isManager || article.visibility === 'PUBLIC' || isMember) {
      return { ...meta, gated: false as const, contentHtml };
    }
    const reason = viewer ? ('MEMBERSHIP' as const) : ('LOGIN' as const);
    if (article.visibility === 'PREVIEW') {
      return {
        ...meta,
        gated: true as const,
        fullAvailable: true,
        reason,
        previewHtml: this.content.previewHtml(contentHtml),
      };
    }
    // MEMBERS_ONLY: enough for a preview card, nothing of the content.
    const body = {
      gated: true,
      reason,
      title: article.title,
      excerpt: article.excerpt,
    };
    throw viewer
      ? new ForbiddenException({
          statusCode: 403,
          message: 'Đăng ký hội viên để đọc bài viết này.',
          ...body,
        })
      : new UnauthorizedException({
          statusCode: 401,
          message: 'Đăng nhập để đọc bài viết này.',
          ...body,
        });
  }

  /** Up to three other published articles that share a tag. */
  private async related(article: {
    id: string;
    tags: CardRow['tags'];
    topics: CardRow['topics'];
  }) {
    const tagSlugs = article.tags.map((row) => row.tag.slug);
    const topicSlugs = article.topics.map((row) => row.topic.slug);
    if (tagSlugs.length === 0 && topicSlugs.length === 0) return [];
    const rows = await this.prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        id: { not: article.id },
        // Sharing a Knowledge topic counts as much as sharing a tag.
        OR: [
          { tags: { some: { tag: { slug: { in: tagSlugs } } } } },
          { topics: { some: { topic: { slug: { in: topicSlugs } } } } },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      select: cardSelect,
    });
    return rows.map(toCard);
  }

  /* ------------------------------------------------------------------------ */
  /* Writing                                                                  */
  /* ------------------------------------------------------------------------ */

  mine(viewer: Viewer) {
    return this.prisma.article
      .findMany({
        where: { authorId: viewer.sub },
        orderBy: { updatedAt: 'desc' },
        select: { ...cardSelect, scheduledAt: true, updatedAt: true },
      })
      .then((rows) => rows.map(toCard));
  }

  /** The article with its editor JSON, for the author or an admin. */
  async getEditable(viewer: Viewer, id: string) {
    const article = await this.findManaged(viewer, id);
    return this.prisma.article
      .findUniqueOrThrow({
        where: { id },
        select: {
          ...cardSelect,
          contentJson: true,
          contentHtml: true,
          scheduledAt: true,
          seriesId: true,
          updatedAt: true,
        },
      })
      .then((row) => ({ ...toCard(row), authorId: article.authorId }));
  }

  private async findManaged(viewer: Viewer, id: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Không tìm thấy bài viết này.');
    if (!canManage(article, viewer)) {
      throw new ForbiddenException('Bạn không có quyền sửa bài viết này.');
    }
    return article;
  }

  /** `title`, `title-2`, `title-3`... Slugs of other articles are never reused. */
  async uniqueSlug(source: string, exceptId?: string): Promise<string> {
    const base =
      slugify(source, { lower: true, locale: 'vi', strict: true }).slice(
        0,
        120,
      ) || 'bai-viet';
    const taken = await this.prisma.article.findMany({
      where: {
        slug: { startsWith: base },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { slug: true },
    });
    const used = new Set(taken.map((row) => row.slug));
    if (RESERVED_SLUGS.has(base)) used.add(base);
    if (!used.has(base)) return base;
    let n = 2;
    while (used.has(`${base}-${n}`)) n += 1;
    return `${base}-${n}`;
  }

  private tagWrite(names: string[]) {
    const unique = new Map(
      names.map((name) => [
        slugify(name, { lower: true, locale: 'vi', strict: true }),
        name,
      ]),
    );
    return [...unique]
      .filter(([slug]) => slug)
      .map(([slug, name]) => ({
        tag: {
          connectOrCreate: { where: { slug }, create: { name, slug } },
        },
      }));
  }

  /** The topics to link, as join rows. Every slug must exist: a writer picks topics, never makes them. */
  private async topicWrite(slugs: string[]) {
    const unique = [...new Set(slugs)];
    if (unique.length === 0) return [];
    const found = await this.prisma.topic.findMany({
      where: { slug: { in: unique } },
      select: { id: true, slug: true },
    });
    const missing = unique.filter(
      (slug) => !found.some((topic) => topic.slug === slug),
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `Không tìm thấy chủ đề: ${missing.join(', ')}`,
      );
    }
    return found.map((topic) => ({ topic: { connect: { id: topic.id } } }));
  }

  private async assertSeries(seriesId?: string | null) {
    if (!seriesId) return;
    const found = await this.prisma.series.findUnique({
      where: { id: seriesId },
      select: { id: true },
    });
    if (!found) throw new BadRequestException('Không tìm thấy series này.');
  }

  async create(viewer: Viewer, dto: CreateArticleInput) {
    await this.assertSeries(dto.seriesId);
    const processed = this.content.process(dto.contentHtml);
    const slug = await this.uniqueSlug(dto.slug || dto.title);

    const created = await this.prisma.article.create({
      data: {
        slug,
        title: dto.title,
        excerpt: dto.excerpt || null,
        coverImageUrl: dto.coverImageUrl || null,
        contentJson: dto.contentJson as Prisma.InputJsonValue,
        contentHtml: processed.html,
        contentText: processed.text,
        readingMinutes: processed.readingMinutes,
        visibility: dto.visibility ?? 'PUBLIC',
        articleType: dto.articleType ?? 'LEARNING_NOTES',
        authorId: viewer.sub,
        seriesId: dto.seriesId ?? null,
        seriesOrder: dto.seriesId ? (dto.seriesOrder ?? null) : null,
        tags: { create: this.tagWrite(dto.tags ?? []) },
        topics: { create: await this.topicWrite(dto.topics ?? []) },
      },
      select: { id: true, slug: true },
    });
    await this.revisions.record(created.id, viewer.sub, {
      title: dto.title,
      contentJson: dto.contentJson as Prisma.InputJsonValue,
      contentHtml: processed.html,
      contentText: processed.text,
    });
    return created;
  }

  async update(viewer: Viewer, id: string, dto: UpdateArticleInput) {
    const article = await this.findManaged(viewer, id);
    if (dto.seriesId !== undefined) await this.assertSeries(dto.seriesId);

    const hasContent =
      dto.contentHtml !== undefined && dto.contentJson !== undefined;
    if ((dto.contentHtml === undefined) !== (dto.contentJson === undefined)) {
      throw new BadRequestException(
        'contentHtml và contentJson phải đi cùng nhau.',
      );
    }
    const processed = hasContent
      ? this.content.process(dto.contentHtml as string)
      : undefined;

    // A published slug never changes by itself; only when the author asks.
    const slug =
      dto.slug && dto.slug !== article.slug
        ? await this.uniqueSlug(dto.slug, id)
        : undefined;

    const updated = await this.prisma.article.update({
      where: { id },
      data: {
        ...(slug ? { slug } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.excerpt !== undefined ? { excerpt: dto.excerpt || null } : {}),
        ...(dto.coverImageUrl !== undefined
          ? { coverImageUrl: dto.coverImageUrl || null }
          : {}),
        ...(dto.visibility ? { visibility: dto.visibility } : {}),
        ...(dto.articleType ? { articleType: dto.articleType } : {}),
        ...(dto.seriesId !== undefined
          ? {
              seriesId: dto.seriesId,
              seriesOrder: dto.seriesId ? (dto.seriesOrder ?? null) : null,
            }
          : dto.seriesOrder !== undefined
            ? { seriesOrder: dto.seriesOrder }
            : {}),
        ...(dto.tags
          ? { tags: { deleteMany: {}, create: this.tagWrite(dto.tags) } }
          : {}),
        ...(dto.topics
          ? {
              topics: {
                deleteMany: {},
                create: await this.topicWrite(dto.topics),
              },
            }
          : {}),
        ...(processed
          ? {
              contentJson: dto.contentJson as Prisma.InputJsonValue,
              contentHtml: processed.html,
              contentText: processed.text,
              readingMinutes: processed.readingMinutes,
            }
          : {}),
      },
      select: { id: true, slug: true, status: true },
    });

    if (processed || dto.title !== undefined) {
      await this.revisions.record(
        id,
        viewer.sub,
        {
          title: dto.title ?? article.title,
          contentJson: (dto.contentJson ??
            article.contentJson) as Prisma.InputJsonValue,
          contentHtml: processed?.html ?? article.contentHtml,
          contentText: processed?.text ?? article.contentText,
        },
        { merge: dto.isAutosave },
      );
    }
    if (updated.status === 'PUBLISHED' || article.status === 'PUBLISHED') {
      await this.refresh(article.slug, updated.slug);
    }
    return updated;
  }

  /** PUBLISHED now, or SCHEDULED when `scheduledAt` is still in the future. */
  async publish(viewer: Viewer, id: string, scheduledAt?: Date) {
    const article = await this.findManaged(viewer, id);
    const now = new Date();
    const isLater =
      scheduledAt !== undefined && scheduledAt.getTime() > now.getTime();
    const updated = await this.prisma.article.update({
      where: { id },
      data: isLater
        ? { status: 'SCHEDULED', scheduledAt, publishedAt: null }
        : {
            status: 'PUBLISHED',
            scheduledAt: null,
            publishedAt: article.publishedAt ?? now,
          },
      select: { id: true, slug: true, status: true, publishedAt: true },
    });
    await this.revisions.record(id, viewer.sub, {
      title: article.title,
      contentJson: article.contentJson as Prisma.InputJsonValue,
      contentHtml: article.contentHtml,
      contentText: article.contentText,
    });
    await this.refresh(article.slug, updated.slug);
    return updated;
  }

  /** A new draft with the same content, for the author who asked; slug, status and history are its own. */
  async duplicate(viewer: Viewer, id: string) {
    const source = await this.findManaged(viewer, id);
    const links = await this.prisma.article.findUniqueOrThrow({
      where: { id },
      select: {
        tags: { select: { tagId: true } },
        topics: { select: { topicId: true } },
      },
    });
    const title = `${source.title} (bản sao)`.slice(0, 200);
    const created = await this.prisma.article.create({
      data: {
        slug: await this.uniqueSlug(title),
        title,
        excerpt: source.excerpt,
        coverImageUrl: source.coverImageUrl,
        contentJson: source.contentJson as Prisma.InputJsonValue,
        contentHtml: source.contentHtml,
        contentText: source.contentText,
        readingMinutes: source.readingMinutes,
        visibility: source.visibility,
        articleType: source.articleType,
        authorId: viewer.sub,
        tags: {
          create: links.tags.map((row) => ({
            tag: { connect: { id: row.tagId } },
          })),
        },
        topics: {
          create: links.topics.map((row) => ({
            topic: { connect: { id: row.topicId } },
          })),
        },
      },
      select: { id: true, slug: true },
    });
    await this.revisions.record(created.id, viewer.sub, {
      title,
      contentJson: source.contentJson as Prisma.InputJsonValue,
      contentHtml: source.contentHtml,
      contentText: source.contentText,
    });
    return created;
  }

  async archive(viewer: Viewer, id: string) {
    const article = await this.findManaged(viewer, id);
    const updated = await this.prisma.article.update({
      where: { id },
      data: { status: 'ARCHIVED' },
      select: { id: true, slug: true, status: true },
    });
    await this.refresh(article.slug);
    return updated;
  }

  async remove(viewer: Viewer, id: string) {
    const article = await this.findManaged(viewer, id);
    await this.prisma.article.delete({ where: { id } });
    await this.refresh(article.slug);
    return { deleted: true };
  }

  /* ------------------------------------------------------------------------ */
  /* Revisions                                                                */
  /* ------------------------------------------------------------------------ */

  async listRevisions(viewer: Viewer, id: string) {
    await this.findManaged(viewer, id);
    return this.revisions.list(id);
  }

  /** Puts an old version back as the current one and records it as a new revision; history is kept. */
  async restoreRevision(viewer: Viewer, id: string, revisionId: string) {
    const article = await this.findManaged(viewer, id);
    const revision = await this.revisions.get(id, revisionId);
    const processed = this.content.process(revision.contentHtml);
    await this.prisma.article.update({
      where: { id },
      data: {
        title: revision.title,
        contentJson: revision.contentJson as Prisma.InputJsonValue,
        contentHtml: processed.html,
        contentText: processed.text,
        readingMinutes: processed.readingMinutes,
      },
    });
    await this.revisions.record(id, viewer.sub, {
      title: revision.title,
      contentJson: revision.contentJson as Prisma.InputJsonValue,
      contentHtml: processed.html,
      contentText: processed.text,
    });
    if (article.status === 'PUBLISHED') await this.refresh(article.slug);
    return this.getEditable(viewer, id);
  }

  /* ------------------------------------------------------------------------ */
  /* Scheduled publishing                                                     */
  /* ------------------------------------------------------------------------ */

  /** Called every minute: scheduled articles whose time has come go live. */
  async publishDue(now = new Date()): Promise<number> {
    const due = await this.prisma.article.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
      select: { id: true, slug: true, scheduledAt: true },
    });
    for (const article of due) {
      await this.prisma.article.update({
        where: { id: article.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: article.scheduledAt ?? now,
          scheduledAt: null,
        },
      });
    }
    if (due.length > 0) {
      await this.cache.invalidateLists();
      for (const article of due)
        await this.revalidator.revalidate(article.slug);
      await this.revalidator.revalidate();
    }
    return due.length;
  }

  /** After any change to what readers see: drop cached lists and rebuild the static pages. */
  private async refresh(...slugs: string[]) {
    await this.cache.invalidateLists();
    await this.revalidator.revalidate();
    for (const slug of new Set(slugs)) await this.revalidator.revalidate(slug);
  }
}
