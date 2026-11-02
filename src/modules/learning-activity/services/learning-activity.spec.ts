import { describe, expect, it } from 'vitest';
import {
  buildCalendarDays,
  buildDayActivities,
  intensityOf,
} from './activity-aggregator.js';
import {
  addDays,
  daysInMonth,
  ictDateKey,
  instantRange,
  isValidDateKey,
  monthDayKeys,
  toIctIso,
} from './ict-date.js';
import { computeStreaks } from './learning-streak.js';
import type { LessonProgressRow } from '../types/learning-activity.type.js';

describe('ict-date: days in Asia/Ho_Chi_Minh', () => {
  it('puts an instant on its Vietnamese calendar day, at the midnight boundary', () => {
    // 16:59:59 UTC on the 13th is 23:59:59 on the 13th in Vietnam; one second later it is the 14th.
    expect(ictDateKey(new Date('2026-11-13T16:59:59.000Z'))).toBe('2026-11-13');
    expect(ictDateKey(new Date('2026-11-13T17:00:00.000Z'))).toBe('2026-11-14');
    expect(ictDateKey(new Date('2026-12-31T17:00:00.000Z'))).toBe('2027-01-01');
  });

  it('writes an instant with the +07:00 offset', () => {
    expect(toIctIso(new Date('2026-11-14T02:00:00.000Z'))).toBe(
      '2026-11-14T09:00:00+07:00',
    );
  });

  it('knows real calendar days only', () => {
    expect(isValidDateKey('2026-11-14')).toBe(true);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026-2-3')).toBe(false);
    expect(isValidDateKey('hom-nay')).toBe(false);
    expect(isValidDateKey('2028-02-29')).toBe(true);
  });

  it('does date arithmetic without a time zone shifting the day', () => {
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(monthDayKeys(2026, 11)).toHaveLength(30);
    expect(monthDayKeys(2026, 11)[0]).toBe('2026-11-01');
  });

  it('turns days into the instants that contain them', () => {
    const { from, to } = instantRange('2026-11-14', '2026-11-14');
    expect(from.toISOString()).toBe('2026-11-13T17:00:00.000Z');
    expect(to.toISOString()).toBe('2026-11-14T17:00:00.000Z');
  });
});

describe('computeStreaks', () => {
  it('counts back from today', () => {
    expect(
      computeStreaks(['2026-11-03', '2026-11-04', '2026-11-05'], '2026-11-05'),
    ).toEqual({ current: 3, longest: 3 });
  });

  it('keeps the streak alive when today has nothing yet (counts from yesterday)', () => {
    expect(computeStreaks(['2026-11-03', '2026-11-04'], '2026-11-05')).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it('breaks after a missed day, and remembers the longest run', () => {
    const days = [
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-11-04',
      '2026-11-05',
    ];
    expect(computeStreaks(days, '2026-11-06')).toEqual({
      current: 2,
      longest: 4,
    });
    expect(computeStreaks(days, '2026-11-08')).toEqual({
      current: 0,
      longest: 4,
    });
  });

  it('counts a day once however it is listed, and ignores days after today', () => {
    expect(
      computeStreaks(
        ['2026-11-05', '2026-11-05', '2026-11-06', '2026-11-07'],
        '2026-11-05',
      ),
    ).toEqual({ current: 1, longest: 1 });
  });

  it('is zero for no activity', () => {
    expect(computeStreaks([], '2026-11-05')).toEqual({
      current: 0,
      longest: 0,
    });
  });

  it('works across a month and a year boundary', () => {
    expect(
      computeStreaks(['2026-12-30', '2026-12-31', '2027-01-01'], '2027-01-01'),
    ).toEqual({ current: 3, longest: 3 });
  });
});

const lesson = (
  overrides: Partial<LessonProgressRow> = {},
): LessonProgressRow => ({
  date: '2026-11-14',
  dayNumber: 14,
  learnCompleted: true,
  practiceCompleted: false,
  testCompleted: false,
  testScore: null,
  gateUnlocked: false,
  completedAt: null,
  ...overrides,
});
const noPhrases = { writes: [], recalls: [], spoken: [] };

describe('buildDayActivities', () => {
  it('lists a lesson step on the lesson day, in the fixed order', () => {
    const days = buildDayActivities(
      [
        lesson({
          practiceCompleted: true,
          testCompleted: true,
          testScore: 85,
          gateUnlocked: true,
          completedAt: new Date('2026-11-14T03:00:00.000Z'),
        }),
      ],
      noPhrases,
    );
    const items = days.get('2026-11-14') ?? [];
    expect(items.map((item) => item.type)).toEqual([
      'DAILY_LESSON',
      'DAILY_PRACTICE',
      'DAILY_TEST',
    ]);
    expect(items[0].title).toBe('Daily English - Day 14');
    expect(items[2].description).toContain('Điểm 85/100');
    expect(items[2].occurredAt).toBe('2026-11-14T10:00:00+07:00');
    expect(items[0].occurredAt).toBeNull(); // not recorded, so not invented
  });

  it('ignores a lesson with no finished step', () => {
    const days = buildDayActivities(
      [lesson({ learnCompleted: false })],
      noPhrases,
    );
    expect(days.size).toBe(0);
    expect(days.get('2026-11-14')).toBeUndefined();
  });

  it('groups Phrase Book actions into one item per kind per day, with real counts', () => {
    const t = (iso: string) => new Date(iso);
    const days = buildDayActivities([], {
      writes: [
        t('2026-11-14T01:00:00.000Z'),
        t('2026-11-14T02:00:00.000Z'),
        t('2026-11-14T03:00:00.000Z'),
      ],
      recalls: [
        { at: t('2026-11-14T04:00:00.000Z'), grade: 'EASY' },
        { at: t('2026-11-14T05:00:00.000Z'), grade: 'FORGOT' },
      ],
      spoken: [
        { at: t('2026-11-14T06:00:00.000Z'), containsPhrase: true },
        { at: t('2026-11-14T07:00:00.000Z'), containsPhrase: false },
      ],
    });
    const items = days.get('2026-11-14') ?? [];
    expect(items.map((item) => item.type)).toEqual([
      'PHRASE_WRITE',
      'PHRASE_RECALL',
      'PHRASE_SPEAK',
    ]);
    expect(items[0].description).toBe('Tạo 3 câu với cụm từ đã lưu');
    expect(items[1].description).toBe('Ôn tập 2 lần, quên 1');
    expect(items[2].description).toBe('Nói 2 lần, 1 lần có dùng đúng cụm từ');
    expect(items[0].occurredAt).toBe('2026-11-14T10:00:00+07:00'); // the latest of the three
  });

  it('puts an action just after Vietnamese midnight on the next day, not the UTC day', () => {
    const days = buildDayActivities([], {
      ...noPhrases,
      writes: [
        new Date('2026-11-13T16:59:59.000Z'), // 23:59:59 on the 13th
        new Date('2026-11-13T17:00:01.000Z'), // 00:00:01 on the 14th
      ],
    });
    expect(days.get('2026-11-13')?.[0].description).toBe(
      'Tạo 1 câu với cụm từ đã lưu',
    );
    expect(days.get('2026-11-14')?.[0].description).toBe(
      'Tạo 1 câu với cụm từ đã lưu',
    );
  });

  it('never repeats an id, even when lesson and phrase work share a day', () => {
    const days = buildDayActivities([lesson({ practiceCompleted: true })], {
      ...noPhrases,
      writes: [new Date('2026-11-14T02:00:00.000Z')],
    });
    const ids = (days.get('2026-11-14') ?? []).map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('2026-11-14:PHRASE_WRITE');
  });

  it('leaves every item without a link: no module has a past-activity screen yet', () => {
    const days = buildDayActivities([lesson()], noPhrases);
    expect(
      days.get('2026-11-14')?.every((item) => item.targetUrl === null),
    ).toBe(true);
  });
});

describe('intensity and the grid', () => {
  it('is the number of kinds of activity, capped at 4; 0 for none', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(intensityOf)).toEqual([
      0, 1, 2, 3, 4, 4, 4,
    ]);
  });

  it('builds every day of the month, one count per day, and nothing after today', () => {
    const activities = buildDayActivities(
      [
        lesson({ date: '2026-11-02', practiceCompleted: true }),
        lesson({ date: '2026-11-20' }), // after "today": must not count
      ],
      noPhrases,
    );
    const days = buildCalendarDays(
      monthDayKeys(2026, 11),
      activities,
      '2026-11-10',
    );
    expect(days).toHaveLength(30);
    expect(days[1]).toEqual({
      date: '2026-11-02',
      hasActivity: true,
      activityCount: 2,
      intensity: 2,
    });
    expect(days[0].intensity).toBe(0);
    expect(days[19]).toMatchObject({ hasActivity: false, activityCount: 0 });
  });

  it('the count on a day equals the length of its list', () => {
    const activities = buildDayActivities(
      [lesson({ practiceCompleted: true, testCompleted: true })],
      { ...noPhrases, writes: [new Date('2026-11-14T02:00:00.000Z')] },
    );
    const [day] = buildCalendarDays(['2026-11-14'], activities, '2026-11-14');
    expect(day.activityCount).toBe(activities.get('2026-11-14')?.length);
  });
});
