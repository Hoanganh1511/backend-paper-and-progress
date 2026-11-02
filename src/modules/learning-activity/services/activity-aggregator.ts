import type {
  CalendarDay,
  DayActivity,
  Intensity,
  LessonProgressRow,
  PhraseEvents,
} from '../types/learning-activity.type.js';
import { ictDateKey, toIctIso } from './ict-date.js';

const latest = (dates: Date[]) =>
  dates.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b));

const groupByDay = <T>(rows: T[], at: (row: T) => Date) => {
  const days = new Map<string, T[]>();
  for (const row of rows) {
    const key = ictDateKey(at(row));
    days.set(key, [...(days.get(key) ?? []), row]);
  }
  return days;
};

const add = (
  days: Map<string, DayActivity[]>,
  date: string,
  activity: Omit<DayActivity, 'id' | 'status' | 'targetUrl'> & {
    type: DayActivity['type'];
  },
) => {
  days.set(date, [
    ...(days.get(date) ?? []),
    {
      id: `${date}:${activity.type}`,
      status: 'COMPLETED',
      // No module has a screen for a past activity yet, so these are read-only.
      targetUrl: null,
      ...activity,
    },
  ]);
};

const ORDER: DayActivity['type'][] = [
  'DAILY_LESSON',
  'DAILY_PRACTICE',
  'DAILY_TEST',
  'PHRASE_WRITE',
  'PHRASE_RECALL',
  'PHRASE_SPEAK',
];

/**
 * Turns what the modules saved into the activities of each day: one entry per
 * kind per day. Only things the server stored count, and a lesson step counts
 * on the lesson's own day, because a lesson can only be done on that day.
 */
export function buildDayActivities(
  lessons: LessonProgressRow[],
  phrases: PhraseEvents,
): Map<string, DayActivity[]> {
  const days = new Map<string, DayActivity[]>();

  for (const lesson of lessons) {
    const title = `Daily English - Day ${String(lesson.dayNumber).padStart(2, '0')}`;
    if (lesson.learnCompleted) {
      add(days, lesson.date, {
        type: 'DAILY_LESSON',
        title,
        description: 'Học từ vựng của bài hôm nay',
        occurredAt: null,
      });
    }
    if (lesson.practiceCompleted) {
      add(days, lesson.date, {
        type: 'DAILY_PRACTICE',
        title: 'Daily English - Luyện tập',
        description: 'Hoàn thành phần luyện tập',
        occurredAt: null,
      });
    }
    if (lesson.testCompleted) {
      const score =
        lesson.testScore === null ? '' : `Điểm ${lesson.testScore}/100. `;
      add(days, lesson.date, {
        type: 'DAILY_TEST',
        title: 'Daily English - Kiểm tra',
        description: `${score}${lesson.gateUnlocked ? 'Đã qua cổng bài học' : 'Chưa qua cổng bài học'}`,
        occurredAt: lesson.completedAt ? toIctIso(lesson.completedAt) : null,
      });
    }
  }

  for (const [date, rows] of groupByDay(phrases.writes, (at) => at)) {
    add(days, date, {
      type: 'PHRASE_WRITE',
      title: 'Sổ cụm từ - Đặt câu',
      description: `Tạo ${rows.length} câu với cụm từ đã lưu`,
      occurredAt: toIctIso(latest(rows)),
    });
  }
  for (const [date, rows] of groupByDay(phrases.recalls, (row) => row.at)) {
    const forgot = rows.filter((row) => row.grade === 'FORGOT').length;
    add(days, date, {
      type: 'PHRASE_RECALL',
      title: 'Sổ cụm từ - Nhớ lại',
      description:
        `Ôn tập ${rows.length} lần` + (forgot > 0 ? `, quên ${forgot}` : ''),
      occurredAt: toIctIso(latest(rows.map((row) => row.at))),
    });
  }
  for (const [date, rows] of groupByDay(phrases.spoken, (row) => row.at)) {
    const matched = rows.filter((row) => row.containsPhrase).length;
    add(days, date, {
      type: 'PHRASE_SPEAK',
      title: 'Sổ cụm từ - Luyện nói',
      description: `Nói ${rows.length} lần, ${matched} lần có dùng đúng cụm từ`,
      occurredAt: toIctIso(latest(rows.map((row) => row.at))),
    });
  }

  for (const [date, list] of days) {
    days.set(
      date,
      [...list].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type)),
    );
  }
  return days;
}

/**
 * How full a day is: by the number of kinds of activity it has (1, 2, 3, 4 or
 * more), the same number the day's list shows. Not a percentage of anything.
 */
export function intensityOf(activityCount: number): Intensity {
  if (activityCount <= 0) return 0;
  return Math.min(activityCount, 4) as Intensity;
}

/** The days of a month for the grid. Days after today have no activity by definition. */
export function buildCalendarDays(
  dayKeys: string[],
  activities: Map<string, DayActivity[]>,
  today: string,
): CalendarDay[] {
  return dayKeys.map((date) => {
    const count = date > today ? 0 : (activities.get(date)?.length ?? 0);
    return {
      date,
      hasActivity: count > 0,
      activityCount: count,
      intensity: intensityOf(count),
    };
  });
}
