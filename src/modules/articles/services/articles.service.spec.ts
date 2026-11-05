import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  ArticlesService,
  articleVersion,
  type Viewer,
} from './articles.service.js';
import { ContentService } from './content.service.js';

const content = new ContentService({ get: () => undefined } as never);

const html = '<p>1</p><p>2</p><p>3</p><p>4</p><p>5</p><p>6</p><p>7</p>';

function article(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    slug: 'hello',
    title: 'Hello',
    excerpt: 'Short',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    authorId: 'author',
    contentHtml: html,
    tags: [],
    topics: [],
    series: null,
    ...overrides,
  };
}

function setup(found: unknown, options: { isMember?: boolean } = {}) {
  const prisma = {
    article: {
      findUnique: vi.fn().mockResolvedValue(found),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockImplementation(({ data }) => ({ id: 'a1', ...data })),
    },
  };
  const revisions = { record: vi.fn() };
  const cache = {
    getOrSet: vi.fn((_key, _ttl, load: () => unknown) => load()),
    invalidateLists: vi.fn(),
  };
  const revalidator = { revalidate: vi.fn() };
  const membership = {
    isMember: vi.fn().mockResolvedValue(options.isMember ?? false),
  };
  const service = new ArticlesService(
    prisma as never,
    content,
    revisions as never,
    cache as never,
    revalidator as never,
    membership as never,
  );
  return { service, prisma, revisions, cache, revalidator, membership };
}

const reader: Viewer = { sub: 'reader', role: 'USER' };
const author: Viewer = { sub: 'author', role: 'CREATOR' };
const admin: Viewer = { sub: 'boss', role: 'ADMIN' };

describe('ArticlesService.getBySlug: who sees what', () => {
  it('404s for a missing article', async () => {
    const { service } = setup(null);
    await expect(service.getBySlug('x')).rejects.toThrow(NotFoundException);
  });

  it.each(['DRAFT', 'SCHEDULED', 'ARCHIVED'])(
    '404s for a %s article when the viewer is not its author or an admin',
    async (status) => {
      const { service } = setup(article({ status }));
      await expect(service.getBySlug('hello')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getBySlug('hello', reader)).rejects.toThrow(
        NotFoundException,
      );
    },
  );

  it('lets the author and admins open a draft', async () => {
    const { service } = setup(article({ status: 'DRAFT' }));
    expect((await service.getBySlug('hello', author)).gated).toBe(false);
    expect((await service.getBySlug('hello', admin)).gated).toBe(false);
  });

  it('serves a public article in full to a guest', async () => {
    const { service } = setup(article());
    const result = await service.getBySlug('hello');
    expect(result).toMatchObject({ gated: false, contentHtml: html });
  });

  it('cuts a preview article for a guest and says to sign in', async () => {
    const { service, membership } = setup(article({ visibility: 'PREVIEW' }));
    const guest = await service.getBySlug('hello');
    expect(guest).toMatchObject({
      gated: true,
      fullAvailable: true,
      reason: 'LOGIN',
    });
    expect(guest).not.toHaveProperty('contentHtml');
    expect((guest as { previewHtml: string }).previewHtml).toBe(
      '<p>1</p><p>2</p><p>3</p>',
    );
    expect(membership.isMember).not.toHaveBeenCalled();
  });

  it('cuts a preview article for a signed-in reader who is not a member', async () => {
    const { service, membership } = setup(article({ visibility: 'PREVIEW' }));
    const result = await service.getBySlug('hello', reader);
    expect(result).toMatchObject({ gated: true, reason: 'MEMBERSHIP' });
    expect(result).not.toHaveProperty('contentHtml');
    expect(membership.isMember).toHaveBeenCalledWith('reader');
  });

  it('gives a member the whole preview article', async () => {
    const { service } = setup(article({ visibility: 'PREVIEW' }), {
      isMember: true,
    });
    expect(await service.getBySlug('hello', reader)).toMatchObject({
      gated: false,
      contentHtml: html,
    });
  });

  it('gives a guest nothing but title and excerpt of a members-only article', async () => {
    const { service } = setup(article({ visibility: 'MEMBERS_ONLY' }));
    const error = await service.getBySlug('hello').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnauthorizedException);
    const body = (error as UnauthorizedException).getResponse();
    expect(body).toMatchObject({
      gated: true,
      reason: 'LOGIN',
      title: 'Hello',
      excerpt: 'Short',
    });
    expect(JSON.stringify(body)).not.toContain('<p>');
  });

  it('turns a signed-in non-member away from a members-only article with a 403', async () => {
    const { service } = setup(article({ visibility: 'MEMBERS_ONLY' }));
    const error = await service
      .getBySlug('hello', reader)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    const body = (error as ForbiddenException).getResponse();
    expect(body).toMatchObject({
      gated: true,
      reason: 'MEMBERSHIP',
      title: 'Hello',
    });
    expect(JSON.stringify(body)).not.toContain('<p>');
  });

  it('serves a members-only article to a member', async () => {
    const { service } = setup(article({ visibility: 'MEMBERS_ONLY' }), {
      isMember: true,
    });
    expect((await service.getBySlug('hello', reader)).gated).toBe(false);
  });

  it('lets the author and admins read a limited article without membership', async () => {
    const { service } = setup(article({ visibility: 'MEMBERS_ONLY' }));
    expect((await service.getBySlug('hello', author)).gated).toBe(false);
    expect((await service.getBySlug('hello', admin)).gated).toBe(false);
  });
});

describe('ArticlesService.uniqueSlug', () => {
  it('adds -2, -3 when the slug is taken and strips Vietnamese marks', async () => {
    const { service, prisma } = setup(null);
    prisma.article.findMany.mockResolvedValue([
      { slug: 'bai-viet-dau-tien' },
      { slug: 'bai-viet-dau-tien-2' },
    ]);
    expect(await service.uniqueSlug('Bài viết đầu tiên')).toBe(
      'bai-viet-dau-tien-3',
    );
    prisma.article.findMany.mockResolvedValue([]);
    expect(await service.uniqueSlug('Bài viết đầu tiên')).toBe(
      'bai-viet-dau-tien',
    );
  });
});

describe('ArticlesService.publish', () => {
  const row = (overrides = {}) =>
    article({
      status: 'DRAFT',
      publishedAt: null,
      contentJson: {},
      contentText: 'x',
      ...overrides,
    });

  it('publishes now and clears the cache and the static pages', async () => {
    const { service, prisma, cache, revalidator, revisions } = setup(row());
    await service.publish(author, 'a1');
    expect(prisma.article.update.mock.calls[0][0].data).toMatchObject({
      status: 'PUBLISHED',
      scheduledAt: null,
    });
    expect(revisions.record).toHaveBeenCalled();
    expect(cache.invalidateLists).toHaveBeenCalled();
    expect(revalidator.revalidate).toHaveBeenCalledWith('hello');
  });

  it('schedules when the date is in the future, publishes when it is past', async () => {
    const { service, prisma } = setup(row());
    const later = new Date(Date.now() + 3_600_000);
    await service.publish(author, 'a1', later);
    expect(prisma.article.update.mock.calls[0][0].data).toMatchObject({
      status: 'SCHEDULED',
      scheduledAt: later,
    });
    await service.publish(author, 'a1', new Date(Date.now() - 1000));
    expect(prisma.article.update.mock.calls[1][0].data.status).toBe(
      'PUBLISHED',
    );
  });

  it("refuses someone else's article", async () => {
    const { service } = setup(row());
    await expect(service.publish(reader, 'a1')).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('ArticlesService.publishDue', () => {
  it('moves due scheduled articles to published with their scheduled time', async () => {
    const at = new Date('2026-11-01T01:00:00Z');
    const { service, prisma, revalidator } = setup(null);
    prisma.article.findMany.mockResolvedValue([
      { id: 'a1', slug: 'one', scheduledAt: at },
    ]);
    expect(await service.publishDue(new Date('2026-11-01T01:00:30Z'))).toBe(1);
    expect(prisma.article.update.mock.calls[0][0].data).toMatchObject({
      status: 'PUBLISHED',
      publishedAt: at,
      scheduledAt: null,
    });
    expect(revalidator.revalidate).toHaveBeenCalledWith('one');
  });

  it('does nothing when nothing is due', async () => {
    const { service, cache } = setup(null);
    expect(await service.publishDue()).toBe(0);
    expect(cache.invalidateLists).not.toHaveBeenCalled();
  });
});

describe('ArticlesService: topics, type and duplicate', () => {
  function setupWrite(topics: { id: string; slug: string }[] = []) {
    const prisma = {
      article: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi
          .fn()
          .mockImplementation(({ data }) => ({ id: 'new', slug: data.slug })),
      },
      topic: { findMany: vi.fn().mockResolvedValue(topics) },
      series: { findUnique: vi.fn() },
    };
    const revisions = { record: vi.fn() };
    const service = new ArticlesService(
      prisma as never,
      content,
      revisions as never,
      { getOrSet: vi.fn(), invalidateLists: vi.fn() } as never,
      { revalidate: vi.fn() } as never,
      { isMember: vi.fn().mockResolvedValue(false) } as never,
    );
    return { service, prisma, revisions };
  }
  const input = {
    title: 'Hello',
    contentJson: { type: 'doc' },
    contentHtml: '<p>Body</p>',
  };

  it('links the topics that exist, each once, and stores the type', async () => {
    const { service, prisma } = setupWrite([
      { id: 't1', slug: 'react' },
      { id: 't2', slug: 'nestjs' },
    ]);
    await service.create(author, {
      ...input,
      articleType: 'TUTORIAL',
      topics: ['react', 'nestjs', 'react'],
    });
    const data = prisma.article.create.mock.calls[0][0].data;
    expect(data.articleType).toBe('TUTORIAL');
    expect(data.topics.create).toEqual([
      { topic: { connect: { id: 't1' } } },
      { topic: { connect: { id: 't2' } } },
    ]);
    expect(prisma.topic.findMany.mock.calls[0][0].where.slug.in).toEqual([
      'react',
      'nestjs',
    ]);
  });

  it('refuses a topic that is not in the Knowledge Library: a writer picks topics, never makes them', async () => {
    const { service, prisma } = setupWrite([{ id: 't1', slug: 'react' }]);
    await expect(
      service.create(author, { ...input, topics: ['react', 'made-up'] }),
    ).rejects.toThrow('made-up');
    expect(prisma.article.create).not.toHaveBeenCalled();
  });

  it('a new article without a type is learning notes, and without topics links none', async () => {
    const { service, prisma } = setupWrite();
    await service.create(author, input);
    const data = prisma.article.create.mock.calls[0][0].data;
    expect(data.articleType).toBe('LEARNING_NOTES');
    expect(data.topics.create).toEqual([]);
  });

  it('duplicates into a new draft of the asker, with the same links and its own slug', async () => {
    const { service, prisma, revisions } = setupWrite();
    const source = article({
      id: 'a1',
      title: 'Hello',
      status: 'PUBLISHED',
      excerpt: 'x',
      contentJson: { type: 'doc' },
      contentText: 'Body',
      readingMinutes: 1,
      articleType: 'TUTORIAL',
      coverImageUrl: null,
    });
    prisma.article.findUnique.mockResolvedValue(source);
    prisma.article.findUniqueOrThrow.mockResolvedValue({
      tags: [{ tagId: 'g1' }],
      topics: [{ topicId: 't1' }],
    });
    prisma.article.findMany.mockResolvedValue([{ slug: 'hello-ban-sao' }]);
    const result = await service.duplicate(author, 'a1');
    const data = prisma.article.create.mock.calls[0][0].data;
    expect(data.title).toBe('Hello (bản sao)');
    expect(data.slug).toBe('hello-ban-sao-2');
    expect(data.authorId).toBe('author');
    expect(data.status).toBeUndefined(); // the schema default is DRAFT
    expect(data.articleType).toBe('TUTORIAL');
    expect(data.topics.create).toEqual([{ topic: { connect: { id: 't1' } } }]);
    expect(data.tags.create).toEqual([{ tag: { connect: { id: 'g1' } } }]);
    expect(revisions.record).toHaveBeenCalled();
    expect(result).toEqual({ id: 'new', slug: 'hello-ban-sao-2' });
  });

  it("does not let someone duplicate another author's article", async () => {
    const { service, prisma } = setupWrite();
    prisma.article.findUnique.mockResolvedValue(article());
    await expect(service.duplicate(reader, 'a1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.article.create).not.toHaveBeenCalled();
  });
});

describe('ArticlesService.update: saving over a version changed elsewhere', () => {
  const stored = article({ coverImageUrl: null, status: 'DRAFT' });
  const edit = {
    title: 'Hello',
    contentHtml: '<p>mine</p>',
    contentJson: { type: 'doc' },
  };

  it('saves when the editor holds the stored version, and returns the new one', async () => {
    const { service, prisma } = setup(stored);
    prisma.article.update.mockResolvedValue({
      id: 'a1',
      slug: 'hello',
      status: 'DRAFT',
    });
    const result = await service.update(author, 'a1', {
      ...edit,
      baseVersion: articleVersion(stored as never),
    });
    expect(prisma.article.update).toHaveBeenCalled();
    expect(result.version).toBe(
      articleVersion({
        title: 'Hello',
        excerpt: 'Short',
        coverImageUrl: null,
        contentHtml: '<p>mine</p>',
      }),
    );
  });

  it('refuses with a 409 instead of overwriting when the stored version moved on', async () => {
    const { service, prisma, revisions } = setup(stored);
    await expect(
      service.update(author, 'a1', { ...edit, baseVersion: 'old-version' }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.article.update).not.toHaveBeenCalled();
    expect(revisions.record).not.toHaveBeenCalled();
  });

  it('lets the writer overwrite on purpose with force', async () => {
    const { service, prisma } = setup(stored);
    prisma.article.update.mockResolvedValue({
      id: 'a1',
      slug: 'hello',
      status: 'DRAFT',
    });
    await service.update(author, 'a1', {
      ...edit,
      baseVersion: 'old-version',
      force: true,
    });
    expect(prisma.article.update).toHaveBeenCalled();
  });

  it('is not a conflict when the same content arrives again (a retry after a lost response)', async () => {
    const saved = article({
      coverImageUrl: null,
      status: 'DRAFT',
      contentHtml: '<p>mine</p>',
    });
    const { service, prisma } = setup(saved);
    prisma.article.update.mockResolvedValue({
      id: 'a1',
      slug: 'hello',
      status: 'DRAFT',
    });
    await service.update(author, 'a1', { ...edit, baseVersion: 'older' });
    expect(prisma.article.update).toHaveBeenCalled();
  });

  it('still saves when the client sends no version (older clients)', async () => {
    const { service, prisma } = setup(stored);
    prisma.article.update.mockResolvedValue({
      id: 'a1',
      slug: 'hello',
      status: 'DRAFT',
    });
    await service.update(author, 'a1', edit);
    expect(prisma.article.update).toHaveBeenCalled();
  });
});
