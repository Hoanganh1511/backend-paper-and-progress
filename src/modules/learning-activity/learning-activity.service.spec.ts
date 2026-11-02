import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  calendarQuerySchema,
  dayParamSchema,
  LearningActivityService,
} from './learning-activity.service.js';

const TODAY = new Date('2026-11-14T00:00:00.000Z');

function setup(
  overrides: {
    lessons?: unknown[];
    phrases?: unknown;
    allDays?: string[];
  } = {},
) {
  const repository = {
    lessonProgress: vi.fn().mockResolvedValue(overrides.lessons ?? []),
    phraseEvents: vi
      .fn()
      .mockResolvedValue(
        overrides.phrases ?? { writes: [], recalls: [], spoken: [] },
      ),
    allActiveDays: vi.fn().mockResolvedValue(overrides.allDays ?? []),
  };
  const dailyGate = { today: vi.fn().mockReturnValue(TODAY) };
  const service = new LearningActivityService(
    repository as never,
    dailyGate as never,
  );
  return { service, repository, dailyGate };
}

describe('LearningActivityService.getCalendar', () => {
  it("uses the Daily Gate's today, and its month when none is asked for", async () => {
    const { service, repository, dailyGate } = setup();
    const result = await service.getCalendar('u1', {});
    expect(dailyGate.today).toHaveBeenCalled();
    expect(result.today).toBe('2026-11-14');
    expect(result.month).toMatchObject({
      year: 2026,
      month: 11,
      timezone: 'Asia/Ho_Chi_Minh',
      daysInMonth: 30,
    });
    expect(repository.lessonProgress).toHaveBeenCalledWith(
      'u1',
      '2026-11-01',
      '2026-11-30',
    );
  });

  it('sums the overview from the same days the grid shows', async () => {
    const { service } = setup({
      lessons: [
        {
          date: '2026-11-13',
          dayNumber: 13,
          learnCompleted: true,
          practiceCompleted: false,
          testCompleted: false,
          testScore: null,
          gateUnlocked: false,
          completedAt: null,
        },
        {
          date: '2026-11-14',
          dayNumber: 14,
          learnCompleted: true,
          practiceCompleted: true,
          testCompleted: false,
          testScore: null,
          gateUnlocked: false,
          completedAt: null,
        },
      ],
      allDays: ['2026-10-20', '2026-11-13', '2026-11-14'],
    });
    const result = await service.getCalendar('u1', {});
    expect(result.summary).toEqual({
      learningDaysInMonth: 2,
      learningDaysTotal: 3,
      currentStreak: 2,
      longestStreak: 2,
    });
    const active = result.days.filter((day) => day.hasActivity);
    expect(active.map((day) => day.date)).toEqual(['2026-11-13', '2026-11-14']);
    expect(active[1]).toMatchObject({ activityCount: 2, intensity: 2 });
  });

  it('shows another month as asked, and counts no future day as learned', async () => {
    const { service } = setup({ allDays: ['2026-12-05'] });
    const result = await service.getCalendar('u1', { year: 2026, month: 12 });
    expect(result.month.month).toBe(12);
    expect(result.days).toHaveLength(31);
    expect(result.days.every((day) => !day.hasActivity)).toBe(true);
    expect(result.summary.learningDaysTotal).toBe(0); // 5 Dec is after today
  });

  it('wants both year and month, or neither', async () => {
    const { service } = setup();
    await expect(service.getCalendar('u1', { year: 2026 })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('LearningActivityService.getCalendar: the goal', () => {
  it('names what is being tracked', async () => {
    const { service } = setup();
    const result = await service.getCalendar('u1', {});
    expect(result.goal).toEqual({
      language: 'English',
      level: 'B2',
      label: 'B2 English',
    });
    expect(result).not.toHaveProperty('tracks');
  });
});

describe('LearningActivityService.getDay', () => {
  it('has no durationMinutes: nothing records how long a learner studied', async () => {
    const { service } = setup();
    const result = await service.getDay('u1', '2026-11-14');
    expect(result.summary).toEqual({ activityCount: 0, durationMinutes: null });
    expect(result.hasActivity).toBe(false);
  });

  it('lists the day, with a count equal to the list', async () => {
    const { service, repository } = setup({
      phrases: {
        writes: [new Date('2026-11-14T02:00:00.000Z')],
        recalls: [],
        spoken: [],
      },
    });
    const result = await service.getDay('u1', '2026-11-14');
    expect(repository.phraseEvents).toHaveBeenCalledWith(
      'u1',
      '2026-11-14',
      '2026-11-14',
    );
    expect(result.activities).toHaveLength(1);
    expect(result.summary.activityCount).toBe(result.activities.length);
    expect(result.hasActivity).toBe(true);
  });

  it('answers a day after today with nothing, without reading the database', async () => {
    const { service, repository } = setup();
    const result = await service.getDay('u1', '2026-11-20');
    expect(result.hasActivity).toBe(false);
    expect(repository.lessonProgress).not.toHaveBeenCalled();
  });
});

describe('request validation', () => {
  it('accepts a real month and rejects nonsense', () => {
    expect(
      calendarQuerySchema.safeParse({ year: '2026', month: '11' }).success,
    ).toBe(true);
    expect(calendarQuerySchema.safeParse({}).success).toBe(true);
    expect(
      calendarQuerySchema.safeParse({ year: 2026, month: 13 }).success,
    ).toBe(false);
    expect(
      calendarQuerySchema.safeParse({ year: 1800, month: 1 }).success,
    ).toBe(false);
    expect(calendarQuerySchema.safeParse({ month: 'abc' }).success).toBe(false);
  });

  it('accepts a real day only', () => {
    expect(dayParamSchema.safeParse('2026-11-14').success).toBe(true);
    expect(dayParamSchema.safeParse('2026-02-30').success).toBe(false);
    expect(dayParamSchema.safeParse('14/11/2026').success).toBe(false);
  });
});
