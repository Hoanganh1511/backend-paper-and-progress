import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { KnowledgeService } from './knowledge.service.js';
import { likePattern } from './search.service.js';

describe('KnowledgeService.listDomains', () => {
  it('counts the categories and the topics under each domain', async () => {
    const prisma = {
      knowledgeCategory: {
        findMany: vi.fn().mockResolvedValue([
          {
            slug: 'cntt',
            name: 'CNTT',
            description: null,
            icon: 'code',
            children: [{ _count: { topics: 10 } }, { _count: { topics: 5 } }],
          },
          {
            slug: 'khac',
            name: 'Khác',
            description: null,
            icon: 'book',
            children: [],
          },
        ]),
      },
    };
    const result = await new KnowledgeService(prisma as never).listDomains();
    expect(result[0]).toMatchObject({
      slug: 'cntt',
      categoryCount: 2,
      topicCount: 15,
    });
    // An empty domain says 0: no made-up number.
    expect(result[1]).toMatchObject({ categoryCount: 0, topicCount: 0 });
  });
});

describe('KnowledgeService.getCategory', () => {
  const topic = (slug: string, groupLabel: string | null) => ({
    slug,
    name: slug,
    description: null,
    icon: 'code',
    groupLabel,
    order: 0,
    _count: { resources: 0, articles: 2, paths: 1 },
  });

  it('gives a category its topics, the groups they fall under and its breadcrumb', async () => {
    const prisma = {
      knowledgeCategory: {
        findUnique: vi.fn().mockResolvedValue({
          slug: 'frontend',
          name: 'Frontend',
          description: null,
          icon: 'frontend',
          parent: { slug: 'cntt', name: 'CNTT' },
          children: [],
          topics: [
            topic('react', 'Framework'),
            topic('vue', 'Framework'),
            topic('ts', 'Ngôn ngữ'),
            topic('x', null),
          ],
        }),
      },
    };
    const result = await new KnowledgeService(prisma as never).getCategory(
      'frontend',
    );
    expect(result.category.isDomain).toBe(false);
    expect(result.breadcrumb).toEqual([{ slug: 'cntt', name: 'CNTT' }]);
    expect(result.groups).toEqual(['Framework', 'Ngôn ngữ']);
    expect(result.topics[0]).toMatchObject({
      slug: 'react',
      articleCount: 2,
      pathCount: 1,
    });
  });

  it('a domain lists its categories with their topic counts', async () => {
    const prisma = {
      knowledgeCategory: {
        findUnique: vi.fn().mockResolvedValue({
          slug: 'cntt',
          name: 'CNTT',
          description: null,
          icon: 'code',
          parent: null,
          children: [
            {
              slug: 'frontend',
              name: 'Frontend',
              description: null,
              icon: 'f',
              _count: { topics: 12 },
            },
          ],
          topics: [],
        }),
      },
    };
    const result = await new KnowledgeService(prisma as never).getCategory(
      'cntt',
    );
    expect(result.category.isDomain).toBe(true);
    expect(result.breadcrumb).toEqual([]);
    expect(result.subcategories).toEqual([
      {
        slug: 'frontend',
        name: 'Frontend',
        description: null,
        icon: 'f',
        topicCount: 12,
      },
    ]);
  });

  it('404s for an unknown category', async () => {
    const prisma = {
      knowledgeCategory: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    await expect(
      new KnowledgeService(prisma as never).getCategory('x'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('KnowledgeService.getTopic', () => {
  const row = {
    id: 't1',
    slug: 'react',
    name: 'React',
    description: null,
    icon: 'code',
    groupLabel: 'Framework',
    category: {
      slug: 'frontend',
      name: 'Frontend',
      parent: { slug: 'cntt', name: 'CNTT' },
    },
    resources: [
      { id: 'r1', title: 'Docs', url: 'https://react.dev', description: null },
      {
        id: 'r2',
        title: 'Tutor',
        url: '/paths/backend-step-tutor',
        description: null,
      },
    ],
    paths: [
      {
        path: {
          slug: 'p',
          title: 'P',
          description: 'd',
          _count: { steps: 5, phases: 2 },
        },
      },
    ],
    articles: [
      {
        article: {
          slug: 'a',
          title: 'A',
          excerpt: null,
          coverImageUrl: null,
          readingMinutes: 3,
          publishedAt: new Date('2026-11-01T00:00:00Z'),
          author: { displayName: 'An' },
        },
      },
    ],
    _count: { articles: 42 },
  };

  function setup(follow: unknown = null) {
    const prisma = {
      topic: { findUnique: vi.fn().mockResolvedValue(row) },
      topicFollow: { findUnique: vi.fn().mockResolvedValue(follow) },
    };
    return { service: new KnowledgeService(prisma as never), prisma };
  }

  it('returns counts, the breadcrumb down to the topic and marks outside links', async () => {
    const { service } = setup();
    const result = await service.getTopic('react');
    expect(result.breadcrumb.map((c) => c.name)).toEqual(['CNTT', 'Frontend']);
    expect(result.counts).toEqual({ articles: 42, paths: 1, resources: 2 });
    expect(result.resources.map((r) => r.isExternal)).toEqual([true, false]);
    expect(result.paths[0]).toMatchObject({
      slug: 'p',
      stepCount: 5,
      phaseCount: 2,
    });
    expect(result.recentArticles[0]).toMatchObject({ slug: 'a', author: 'An' });
  });

  it('knows whether this user follows it, and does not look for a guest', async () => {
    const guest = setup();
    expect((await guest.service.getTopic('react')).isFollowing).toBe(false);
    expect(guest.prisma.topicFollow.findUnique).not.toHaveBeenCalled();

    const following = setup({ userId: 'u1' });
    expect((await following.service.getTopic('react', 'u1')).isFollowing).toBe(
      true,
    );
  });

  it('404s for an unknown topic', async () => {
    const { service, prisma } = setup();
    prisma.topic.findUnique.mockResolvedValue(null);
    await expect(service.getTopic('x')).rejects.toThrow(NotFoundException);
  });
});

describe('KnowledgeService follow', () => {
  it('follows once however many times it is pressed, and unfollowing a topic you do not follow is fine', async () => {
    const prisma = {
      topic: { findUnique: vi.fn().mockResolvedValue({ id: 't1' }) },
      topicFollow: {
        upsert: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const service = new KnowledgeService(prisma as never);
    expect(await service.follow('u1', 'react')).toEqual({ isFollowing: true });
    expect(prisma.topicFollow.upsert.mock.calls[0][0].update).toEqual({});
    expect(await service.unfollow('u1', 'react')).toEqual({
      isFollowing: false,
    });
  });
});

describe('likePattern', () => {
  it('escapes the characters ILIKE reads as wildcards', () => {
    expect(likePattern('100%_a')).toBe('%100\\%\\_a%');
  });
});
