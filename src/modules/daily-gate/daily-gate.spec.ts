import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  DailyGateService,
  MIN_READY_WORDS,
} from './services/daily-gate.service.js';
import { QuizGeneratorService } from './services/quiz-generator.service.js';

const TODAY = '2026-11-05';
const lesson = {
  id: 5,
  dayNumber: 5,
  date: new Date(`${TODAY}T00:00:00.000Z`),
  type: 'NEW' as const,
  unitIds: [1],
  createdAt: new Date(0),
};

const progressRow = {
  id: 1,
  userId: 'u1',
  lessonId: 5,
  learnCompleted: false,
  practiceCompleted: false,
  testCompleted: false,
  testScore: null as number | null,
  bestScore: null as number | null,
  testAttempts: 0,
  gateUnlocked: false,
  completedAt: null,
};

function setup(
  options: {
    lesson?: typeof lesson | null;
    wordCount?: number;
    progress?: Partial<typeof progressRow>;
    first?: typeof lesson | null;
    last?: typeof lesson | null;
  } = {},
) {
  const prisma = {
    dailyLesson: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          options.lesson === undefined ? lesson : options.lesson,
        ),
      findFirst: vi
        .fn()
        .mockImplementation(({ orderBy }: { orderBy: { dayNumber: string } }) =>
          Promise.resolve(
            orderBy.dayNumber === 'asc'
              ? (options.first ?? null)
              : (options.last ?? null),
          ),
        ),
    },
    userDailyProgress: {
      upsert: vi
        .fn()
        .mockResolvedValue({ ...progressRow, ...options.progress }),
      update: vi.fn().mockResolvedValue({ ...progressRow, gateUnlocked: true }),
    },
    wordReview: { createMany: vi.fn() },
  };
  const vocabulary = {
    countWords: vi.fn().mockResolvedValue(options.wordCount ?? 80),
    unitsByIds: vi
      .fn()
      .mockResolvedValue([
        { id: 1, unitNumber: 2, topic: 'Travel and transport' },
      ]),
    wordsOfUnits: vi.fn().mockResolvedValue([]),
  };
  const config = {
    get: vi.fn((key: string) =>
      key === 'DAILY_GATE_TODAY' ? TODAY : undefined,
    ),
  };
  const service = new DailyGateService(
    prisma as never,
    vocabulary as never,
    new QuizGeneratorService(),
    config as never,
  );
  return { service, prisma, vocabulary };
}

describe('DailyGateService.getToday', () => {
  it("gives today's lesson with the user's progress", async () => {
    const { service } = setup({ progress: { learnCompleted: true } });
    expect(await service.getToday('u1')).toMatchObject({
      active: true,
      lessonId: 5,
      dayNumber: 5,
      date: TODAY,
      type: 'NEW',
      isReady: true,
      progress: { learnCompleted: true, gateUnlocked: false },
    });
  });

  it('says the lesson is not ready while its words are still to be written', async () => {
    const { service } = setup({ wordCount: MIN_READY_WORDS - 1 });
    expect(await service.getToday('u1')).toMatchObject({ isReady: false });
  });

  it('says why there is no lesson: before the first day, or after the last', async () => {
    const first = {
      ...lesson,
      dayNumber: 1,
      date: new Date('2026-11-10T00:00:00.000Z'),
    };
    const before = setup({ lesson: null, first, last: first });
    expect(await before.service.getToday('u1')).toEqual({
      active: false,
      reason: 'NOT_STARTED',
      startDate: '2026-11-10',
    });

    const last = {
      ...lesson,
      dayNumber: 30,
      date: new Date('2026-11-01T00:00:00.000Z'),
    };
    const after = setup({ lesson: null, first: last, last });
    expect(await after.service.getToday('u1')).toMatchObject({
      active: false,
      reason: 'FINISHED',
    });
  });
});

describe('DailyGateService order of steps', () => {
  it('asks for the lesson to be learned before practice', async () => {
    const { service } = setup({ progress: { learnCompleted: false } });
    await expect(service.getPractice('u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('asks for the practice to be done before the test', async () => {
    const { service } = setup({
      progress: { learnCompleted: true, practiceCompleted: false },
    });
    await expect(service.getTest('u1')).rejects.toThrow(BadRequestException);
    await expect(
      service.submitTest('u1', { lessonId: 5, answers: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  it("refuses a lesson id that is not today's", async () => {
    const { service } = setup();
    await expect(service.completeLearn('u1', { lessonId: 99 })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('DailyGateService.submitTest', () => {
  const done = { learnCompleted: true, practiceCompleted: true };

  it('does not mark the day as done on a score under 70%', async () => {
    const { service, prisma, vocabulary } = setup({ progress: done });
    // No words at all: no questions, so the score is 0 and the day is not done
    vocabulary.wordsOfUnits.mockResolvedValue([]);
    const failed = await service.submitTest('u1', { lessonId: 5, answers: [] });
    expect(failed.passed).toBe(false);
    expect(prisma.userDailyProgress.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ gateUnlocked: true }),
      }),
    );
  });

  it('does not lock the day again after it was passed', async () => {
    const { service, prisma } = setup({
      progress: { ...done, gateUnlocked: true, bestScore: 90 },
    });
    await service.submitTest('u1', { lessonId: 5, answers: [] });
    const data = prisma.userDailyProgress.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('gateUnlocked');
    expect(data.bestScore).toBe(90);
    expect(data.testAttempts).toEqual({ increment: 1 });
  });
});
