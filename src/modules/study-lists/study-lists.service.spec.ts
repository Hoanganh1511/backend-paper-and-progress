import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { createStepSchema } from './study-lists.schema.js';
import {
  StudyListsService,
  progressOfSections,
} from './study-lists.service.js';

function setup(options: { list?: object | null } = {}) {
  const list =
    options.list === undefined
      ? {
          id: 'l1',
          userId: 'u1',
          title: 'AWS plan',
          description: null,
          createdAt: new Date(0),
          sections: [],
          certificates: [],
        }
      : options.list;
  const prisma = {
    studyList: {
      findMany: vi.fn().mockResolvedValue(list ? [list] : []),
      findFirst: vi.fn().mockResolvedValue(list),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'l1' }),
      update: vi.fn(),
      delete: vi.fn(),
    },
    studySection: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]),
      create: vi.fn(),
      update: vi.fn(),
    },
    studyStep: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
    },
    article: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  };
  return { service: new StudyListsService(prisma as never), prisma };
}

describe('progressOfSections', () => {
  it('counts the ticked steps, and is 0 for no steps', () => {
    expect(progressOfSections([])).toEqual({
      stepCount: 0,
      doneStepCount: 0,
      progress: 0,
    });
    expect(
      progressOfSections([
        { steps: [{ isDone: true }, { isDone: true }] },
        { steps: [{ isDone: false }] },
      ]),
    ).toEqual({ stepCount: 3, doneStepCount: 2, progress: 67 });
  });
});

describe('StudyListsService', () => {
  it("lists only the user's lists, with their progress and linked certificates", async () => {
    const { service, prisma } = setup({
      list: {
        id: 'l1',
        title: 'AWS plan',
        description: null,
        sections: [{ steps: [{ isDone: true }, { isDone: false }] }],
        certificates: [{ id: 'c1', name: 'AWS SAA' }],
      },
    });
    const [item] = await service.list('u1');
    expect(prisma.studyList.findMany.mock.calls[0][0].where).toEqual({
      userId: 'u1',
    });
    expect(item).toMatchObject({
      progress: 50,
      sectionCount: 1,
      certificates: [{ id: 'c1', name: 'AWS SAA' }],
    });
  });

  it('creates a list for the user', async () => {
    const { service, prisma } = setup();
    await service.create('u1', { title: 'AWS plan', description: '' });
    expect(prisma.studyList.create.mock.calls[0][0].data).toEqual({
      userId: 'u1',
      title: 'AWS plan',
      description: null,
    });
  });

  it('404s for a list, section or step of someone else', async () => {
    const { service } = setup({ list: null });
    await expect(service.get('u1', 'x')).rejects.toThrow(NotFoundException);
    await expect(service.remove('u1', 'x')).rejects.toThrow(NotFoundException);
    await expect(service.addSection('u1', 'x', { title: 'A' })).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.updateSection('u1', 'x', { title: 'A' }),
    ).rejects.toThrow(NotFoundException);
    await expect(service.removeStep('u1', 'x')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('reorders sections only with exactly the ids it has', async () => {
    const { service, prisma } = setup();
    await expect(service.reorderSections('u1', 'l1', ['a'])).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.reorderSections('u1', 'l1', ['a', 'a']),
    ).rejects.toThrow(BadRequestException);
    await service.reorderSections('u1', 'l1', ['b', 'a']);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('steps that are articles', () => {
  const article = {
    id: 'a1',
    slug: 'hoc-react',
    title: 'Học React',
    status: 'PUBLISHED',
    readingMinutes: 5,
  };

  function withSection() {
    const made = setup();
    made.prisma.studySection.findFirst.mockResolvedValue({
      id: 's1',
      studyListId: 'l1',
    });
    return made;
  }

  it('takes the title of the article a step points to', async () => {
    const { service, prisma } = withSection();
    prisma.article.findFirst.mockResolvedValue(article);
    await service.addStep('u1', 's1', { articleId: 'a1' });
    expect(prisma.studyStep.create.mock.calls[0][0].data).toMatchObject({
      sectionId: 's1',
      title: 'Học React',
      articleId: 'a1',
    });
  });

  it("only links an article that is published or the learner's own", async () => {
    const { service, prisma } = withSection();
    prisma.article.findFirst.mockResolvedValue(article);
    await service.addStep('u1', 's1', { articleId: 'a1' });
    expect(prisma.article.findFirst.mock.calls[0][0].where).toEqual({
      id: 'a1',
      OR: [{ status: 'PUBLISHED' }, { authorId: 'u1' }],
    });

    prisma.article.findFirst.mockResolvedValue(null);
    await expect(
      service.addStep('u1', 's1', { articleId: 'someone-elses-draft' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('keeps a step written by hand, with its own title and no article', async () => {
    const { service, prisma } = withSection();
    await service.addStep('u1', 's1', { title: 'Do the lab' });
    expect(prisma.studyStep.create.mock.calls[0][0].data).toMatchObject({
      title: 'Do the lab',
      articleId: null,
    });
    expect(prisma.article.findFirst).not.toHaveBeenCalled();
  });

  it('links and unlinks an article on an existing step', async () => {
    const { service, prisma } = setup();
    prisma.studyStep.findFirst.mockResolvedValue({
      id: 't1',
      isDone: false,
      section: { studyListId: 'l1' },
    });
    prisma.article.findFirst.mockResolvedValue(article);
    await service.updateStep('u1', 't1', { articleId: 'a1' });
    expect(prisma.studyStep.update.mock.calls[0][0].data.articleId).toBe('a1');
    await service.updateStep('u1', 't1', { articleId: '' });
    expect(prisma.studyStep.update.mock.calls[1][0].data.articleId).toBeNull();
    await service.updateStep('u1', 't1', { title: 'New' });
    expect(
      prisma.studyStep.update.mock.calls[2][0].data.articleId,
    ).toBeUndefined();
  });

  it("searches published articles and the learner's own drafts by title", async () => {
    const { service, prisma } = setup();
    prisma.article.findMany.mockResolvedValue([article]);
    expect(await service.searchArticles('u1', { q: 'react' })).toEqual([
      article,
    ]);
    expect(prisma.article.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ status: 'PUBLISHED' }, { authorId: 'u1' }],
      title: { contains: 'react', mode: 'insensitive' },
    });
  });

  it('needs an article or a title to make a step', () => {
    expect(createStepSchema.safeParse({}).success).toBe(false);
    expect(createStepSchema.safeParse({ title: 'Do the lab' }).success).toBe(
      true,
    );
    expect(createStepSchema.safeParse({ articleId: 'a1' }).success).toBe(true);
  });
});
