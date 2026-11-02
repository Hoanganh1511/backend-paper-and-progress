import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service.js';

/** Counts only what readers can see: published articles and published paths. */
const publishedArticle = { article: { status: 'PUBLISHED' as const } };
const publishedPath = { path: { status: 'PUBLISHED' as const } };

const crumb = (category: { slug: string; name: string }) => ({
  slug: category.slug,
  name: category.name,
});

@Injectable()
export class KnowledgeService {
  constructor(private prisma: PrismaService) {}

  /** The top level of the library: each domain with how many categories and topics it holds. */
  async listDomains() {
    const domains = await this.prisma.knowledgeCategory.findMany({
      where: { parentId: null },
      orderBy: { order: 'asc' },
      include: {
        children: { select: { _count: { select: { topics: true } } } },
      },
    });
    return domains.map(({ children, ...domain }) => ({
      slug: domain.slug,
      name: domain.name,
      description: domain.description,
      icon: domain.icon,
      categoryCount: children.length,
      topicCount: children.reduce((sum, child) => sum + child._count.topics, 0),
    }));
  }

  /**
   * A domain (its categories) or a category (its topics). `groups` are the
   * labels the topics fall under, for the filter tabs of a topic list.
   */
  async getCategory(slug: string) {
    const category = await this.prisma.knowledgeCategory.findUnique({
      where: { slug },
      include: {
        parent: { select: { slug: true, name: true } },
        children: {
          orderBy: { order: 'asc' },
          include: { _count: { select: { topics: true } } },
        },
        topics: {
          orderBy: { order: 'asc' },
          include: {
            _count: {
              select: {
                resources: true,
                articles: { where: publishedArticle },
                paths: { where: publishedPath },
              },
            },
          },
        },
      },
    });
    if (!category) throw new NotFoundException('Không tìm thấy danh mục này.');

    const groups = [
      ...new Set(
        category.topics.flatMap((topic) =>
          topic.groupLabel ? [topic.groupLabel] : [],
        ),
      ),
    ];
    return {
      category: {
        slug: category.slug,
        name: category.name,
        description: category.description,
        icon: category.icon,
        isDomain: category.parent === null,
      },
      breadcrumb: category.parent ? [crumb(category.parent)] : [],
      subcategories: category.children.map((child) => ({
        slug: child.slug,
        name: child.name,
        description: child.description,
        icon: child.icon,
        topicCount: child._count.topics,
      })),
      groups,
      topics: category.topics.map((topic) => ({
        slug: topic.slug,
        name: topic.name,
        description: topic.description,
        icon: topic.icon,
        groupLabel: topic.groupLabel,
        articleCount: topic._count.articles,
        pathCount: topic._count.paths,
        resourceCount: topic._count.resources,
      })),
    };
  }

  /** One topic with what is linked to it: resources, the latest articles and the paths that cover it. */
  async getTopic(slug: string, userId?: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { slug },
      include: {
        category: {
          include: { parent: { select: { slug: true, name: true } } },
        },
        resources: { orderBy: { order: 'asc' } },
        paths: {
          where: publishedPath,
          include: {
            path: {
              select: {
                slug: true,
                title: true,
                description: true,
                _count: { select: { steps: true, phases: true } },
              },
            },
          },
        },
        articles: {
          where: publishedArticle,
          orderBy: { article: { publishedAt: 'desc' } },
          take: 3,
          include: {
            article: {
              select: {
                slug: true,
                title: true,
                excerpt: true,
                coverImageUrl: true,
                readingMinutes: true,
                publishedAt: true,
                author: { select: { displayName: true } },
              },
            },
          },
        },
        _count: { select: { articles: { where: publishedArticle } } },
      },
    });
    if (!topic) throw new NotFoundException('Không tìm thấy chủ đề này.');

    const follow = userId
      ? await this.prisma.topicFollow.findUnique({
          where: { userId_topicId: { userId, topicId: topic.id } },
        })
      : null;
    const { category } = topic;
    return {
      topic: {
        slug: topic.slug,
        name: topic.name,
        description: topic.description,
        icon: topic.icon,
        groupLabel: topic.groupLabel,
      },
      breadcrumb: [
        ...(category.parent ? [crumb(category.parent)] : []),
        crumb(category),
      ],
      counts: {
        articles: topic._count.articles,
        paths: topic.paths.length,
        resources: topic.resources.length,
      },
      isFollowing: follow !== null,
      resources: topic.resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        url: resource.url,
        description: resource.description,
        // "/..." is a page of this site; anything else leaves it.
        isExternal: !resource.url.startsWith('/'),
      })),
      paths: topic.paths.map(({ path }) => ({
        slug: path.slug,
        title: path.title,
        description: path.description,
        phaseCount: path._count.phases,
        stepCount: path._count.steps,
      })),
      recentArticles: topic.articles.map(({ article }) => ({
        ...article,
        author: article.author.displayName,
      })),
    };
  }

  private async requireTopic(slug: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!topic) throw new NotFoundException('Không tìm thấy chủ đề này.');
    return topic;
  }

  async follow(userId: string, slug: string) {
    const topic = await this.requireTopic(slug);
    await this.prisma.topicFollow.upsert({
      where: { userId_topicId: { userId, topicId: topic.id } },
      create: { userId, topicId: topic.id },
      update: {},
    });
    return { isFollowing: true };
  }

  async unfollow(userId: string, slug: string) {
    const topic = await this.requireTopic(slug);
    await this.prisma.topicFollow.deleteMany({
      where: { userId, topicId: topic.id },
    });
    return { isFollowing: false };
  }

  /** The topics a user follows, newest first. */
  async followed(userId: string) {
    const rows = await this.prisma.topicFollow.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        topic: {
          select: {
            slug: true,
            name: true,
            icon: true,
            category: { select: { name: true } },
          },
        },
      },
    });
    return rows.map(({ topic, createdAt }) => ({
      slug: topic.slug,
      name: topic.name,
      icon: topic.icon,
      categoryName: topic.category.name,
      followedAt: createdAt,
    }));
  }

  /**
   * Topics to pick from, e.g. in the article editor. With `q`, those whose name
   * contains it; the category is returned so equal names can be told apart.
   */
  async searchTopics(q: string | undefined, limit: number) {
    const rows = await this.prisma.topic.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: [{ name: 'asc' }],
      take: limit,
      select: {
        slug: true,
        name: true,
        icon: true,
        category: { select: { name: true } },
      },
    });
    return rows.map((topic) => ({
      slug: topic.slug,
      name: topic.name,
      icon: topic.icon,
      categoryName: topic.category.name,
    }));
  }
}
