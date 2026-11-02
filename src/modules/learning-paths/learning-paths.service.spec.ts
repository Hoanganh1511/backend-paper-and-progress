import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  collectCheckIds,
  LearningPathsService,
  pathState,
  stepProgressSchema,
  totalMinutes,
} from './learning-paths.service.js';

describe('collectCheckIds', () => {
  it('finds checklist items, also inside a details block', () => {
    const content = [
      {
        title: 'Bắt đầu',
        content: [
          { type: 'text', text: 'x' },
          { type: 'check', id: 'c1', text: 'a' },
          {
            type: 'details',
            summary: 's',
            content: [{ type: 'check', id: 'c2', text: 'b' }],
          },
        ],
      },
      { content: [{ type: 'check', id: 'c3', text: 'c' }] },
    ];
    expect(collectCheckIds(content)).toEqual(['c1', 'c2', 'c3']);
  });

  it('copes with content that is not what it expects', () => {
    expect(collectCheckIds(null)).toEqual([]);
    expect(collectCheckIds('x')).toEqual([]);
    expect(collectCheckIds([{ type: 'check' }])).toEqual([]);
  });
});

describe('pathState', () => {
  it('is not started, in progress or completed, by what was really done', () => {
    expect(pathState(0, 19, false)).toBe('NOT_STARTED');
    expect(pathState(0, 19, true)).toBe('IN_PROGRESS'); // started, nothing done yet
    expect(pathState(4, 19, false)).toBe('IN_PROGRESS');
    expect(pathState(19, 19, true)).toBe('COMPLETED');
    expect(pathState(0, 0, true)).toBe('IN_PROGRESS'); // a path with no steps is never "completed"
  });
});

describe('totalMinutes', () => {
  it('adds up only when every step says how long it takes', () => {
    expect(totalMinutes([45, 120, 30])).toBe(195);
    expect(totalMinutes([45, null, 30])).toBeNull();
    expect(totalMinutes([])).toBeNull();
  });
});

describe('stepProgressSchema', () => {
  it('accepts a partial update and refuses a note that is too long or a non-boolean tick', () => {
    expect(stepProgressSchema.safeParse({ isDone: true }).success).toBe(true);
    expect(stepProgressSchema.safeParse({ note: null }).success).toBe(true);
    expect(
      stepProgressSchema.safeParse({ note: 'x'.repeat(5001) }).success,
    ).toBe(false);
    expect(stepProgressSchema.safeParse({ checks: { a: 'yes' } }).success).toBe(
      false,
    );
  });
});

describe('LearningPathsService.saveStepProgress', () => {
  const step = {
    id: 's1',
    slug: 'ds1',
    pathId: 'p1',
    content: [{ content: [{ type: 'check', id: 'c1', text: 'a' }] }],
  };

  function setup(existing: unknown = null) {
    const prisma = {
      learningPath: { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }) },
      learningStep: { findUnique: vi.fn().mockResolvedValue(step) },
      userStepProgress: {
        findUnique: vi.fn().mockResolvedValue(existing),
        upsert: vi.fn().mockResolvedValue({}),
      },
      userPathProgress: { upsert: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
    };
    const service = new LearningPathsService(prisma as never);
    // The read after saving is not what is tested here.
    vi.spyOn(service, 'getStep').mockResolvedValue({
      mine: { isDone: true },
    } as never);
    vi.spyOn(service, 'getBySlug').mockResolvedValue({
      progress: { completedSteps: 1 },
    } as never);
    return { service, prisma };
  }
  const saved = (prisma: ReturnType<typeof setup>['prisma']) =>
    prisma.userStepProgress.upsert.mock.calls[0][0].create;

  it('marks done with a time, and starts the path at this step', async () => {
    const { service, prisma } = setup();
    await service.saveStepProgress('u1', 'p', 'ds1', { isDone: true });
    expect(saved(prisma).completedAt).toBeInstanceOf(Date);
    expect(prisma.userPathProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: 'u1', pathId: 'p1', lastStepId: 's1' },
      }),
    );
  });

  it('keeps the first completion time when marked done again, and clears it when undone', async () => {
    const first = new Date('2026-11-01T01:00:00Z');
    const { service, prisma } = setup({
      completedAt: first,
      checks: {},
      note: null,
    });
    await service.saveStepProgress('u1', 'p', 'ds1', { isDone: true });
    expect(saved(prisma).completedAt).toEqual(first);

    const again = setup({ completedAt: first, checks: {}, note: null });
    await again.service.saveStepProgress('u1', 'p', 'ds1', { isDone: false });
    expect(saved(again.prisma).completedAt).toBeNull();
  });

  it('leaves what was not sent as it was', async () => {
    const first = new Date('2026-11-01T01:00:00Z');
    const { service, prisma } = setup({
      completedAt: first,
      checks: { c1: true },
      note: 'giữ',
    });
    await service.saveStepProgress('u1', 'p', 'ds1', { note: 'mới' });
    expect(saved(prisma)).toMatchObject({
      completedAt: first,
      checks: { c1: true },
      note: 'mới',
    });
  });

  it('merges checklist ticks and trims or clears the note', async () => {
    const { service, prisma } = setup({
      completedAt: null,
      checks: { c1: true },
      note: 'x',
    });
    await service.saveStepProgress('u1', 'p', 'ds1', {
      checks: { c1: false },
      note: '   ',
    });
    expect(saved(prisma).checks).toEqual({ c1: false });
    expect(saved(prisma).note).toBeNull();
  });

  it('refuses a checklist item the step does not have, and saves nothing', async () => {
    const { service, prisma } = setup();
    await expect(
      service.saveStepProgress('u1', 'p', 'ds1', { checks: { nope: true } }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.userStepProgress.upsert).not.toHaveBeenCalled();
  });

  it('404s for an unknown path or step', async () => {
    const a = setup();
    a.prisma.learningPath.findFirst.mockResolvedValue(null);
    await expect(
      a.service.saveStepProgress('u1', 'x', 'ds1', {}),
    ).rejects.toThrow(NotFoundException);
    const b = setup();
    b.prisma.learningStep.findUnique.mockResolvedValue(null);
    await expect(
      b.service.saveStepProgress('u1', 'p', 'zz', {}),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('LearningPathsService.list', () => {
  it('has no progress for a guest, and no progress for a path the user has not begun', async () => {
    const path = {
      id: 'p1',
      slug: 'backend',
      title: 'Backend',
      description: 'd',
      level: null,
      topics: [{ topic: { slug: 'nestjs', name: 'NestJS' } }],
      phases: [{ id: 'f1' }],
      steps: [
        { id: 's1', durationMinutes: 30 },
        { id: 's2', durationMinutes: 60 },
      ],
    };
    const prisma = {
      learningPath: { findMany: vi.fn().mockResolvedValue([path]) },
      userPathProgress: { findMany: vi.fn().mockResolvedValue([]) },
      userStepProgress: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new LearningPathsService(prisma as never);

    const guest = await service.list({});
    expect(guest[0]).toMatchObject({
      stepCount: 2,
      phaseCount: 1,
      totalMinutes: 90,
      progress: null,
    });
    expect(prisma.userStepProgress.findMany).not.toHaveBeenCalled();

    const fresh = await service.list({}, 'u1');
    expect(fresh[0].progress).toEqual({
      state: 'NOT_STARTED',
      completedSteps: 0,
      totalSteps: 2,
    });

    prisma.userStepProgress.findMany.mockResolvedValue([
      { stepId: 's1', step: { pathId: 'p1' } },
    ]);
    const going = await service.list({}, 'u1');
    expect(going[0].progress).toEqual({
      state: 'IN_PROGRESS',
      completedSteps: 1,
      totalSteps: 2,
    });
  });

  it('filters by topic, level and search text', async () => {
    const prisma = {
      learningPath: { findMany: vi.fn().mockResolvedValue([]) },
      userPathProgress: { findMany: vi.fn() },
      userStepProgress: { findMany: vi.fn() },
    };
    await new LearningPathsService(prisma as never).list({
      topic: 'nestjs',
      level: 'BEGINNER',
      q: 'api',
    });
    const where = prisma.learningPath.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      status: 'PUBLISHED',
      level: 'BEGINNER',
      topics: { some: { topic: { slug: 'nestjs' } } },
    });
    expect(where.OR).toHaveLength(2);
  });
});
