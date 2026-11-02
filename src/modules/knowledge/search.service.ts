import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service.js';

/** Escapes `%` and `_`, which `ILIKE` would read as wildcards. */
export const likePattern = (q: string) =>
  `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  /**
   * One search over the four kinds of content. Each group is capped, and carries
   * its own total so the page can say "5 of 12".
   */
  async search(q: string, limit: number) {
    const contains = { contains: q, mode: 'insensitive' as const };
    const topicWhere = {
      OR: [{ name: contains }, { description: contains }],
    };
    const resourceWhere = {
      OR: [{ title: contains }, { description: contains }],
    };
    const pathWhere = {
      status: 'PUBLISHED' as const,
      OR: [{ title: contains }, { description: contains }],
    };

    const [topics, topicTotal, resources, resourceTotal, paths, pathTotal] =
      await Promise.all([
        this.prisma.topic.findMany({
          where: topicWhere,
          take: limit,
          orderBy: { name: 'asc' },
          select: {
            slug: true,
            name: true,
            icon: true,
            category: { select: { name: true } },
          },
        }),
        this.prisma.topic.count({ where: topicWhere }),
        this.prisma.knowledgeResource.findMany({
          where: resourceWhere,
          take: limit,
          select: {
            id: true,
            title: true,
            url: true,
            topic: { select: { slug: true, name: true } },
          },
        }),
        this.prisma.knowledgeResource.count({ where: resourceWhere }),
        this.prisma.learningPath.findMany({
          where: pathWhere,
          take: limit,
          orderBy: { order: 'asc' },
          select: { slug: true, title: true, description: true },
        }),
        this.prisma.learningPath.count({ where: pathWhere }),
      ]);

    // Articles use the full-text index (title, excerpt and body), ranked.
    const matches = (pattern: string) => this.prisma.$queryRaw<
      { id: string }[]
    >`
      SELECT id FROM "Article"
      WHERE status = 'PUBLISHED'
        AND ("searchVector" @@ websearch_to_tsquery('simple', ${q})
          OR title ILIKE ${pattern})
      ORDER BY ts_rank("searchVector", websearch_to_tsquery('simple', ${q})) DESC, id
      LIMIT ${limit}`;
    const [found, [{ count }]] = await Promise.all([
      matches(likePattern(q)),
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*) FROM "Article"
        WHERE status = 'PUBLISHED'
          AND ("searchVector" @@ websearch_to_tsquery('simple', ${q})
            OR title ILIKE ${likePattern(q)})`,
    ]);
    const pageIds = found.map((row) => row.id);
    const rows = await this.prisma.article.findMany({
      where: { id: { in: pageIds } },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        articleType: true,
        author: { select: { displayName: true } },
      },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const articles = pageIds.flatMap((id) => {
      const row = byId.get(id);
      return row ? [{ ...row, author: row.author.displayName }] : [];
    });

    return {
      query: q,
      topics: {
        total: topicTotal,
        items: topics.map(({ category, ...t }) => ({
          ...t,
          categoryName: category.name,
        })),
      },
      resources: { total: resourceTotal, items: resources },
      articles: { total: Number(count), items: articles },
      paths: { total: pathTotal, items: paths },
    };
  }
}
