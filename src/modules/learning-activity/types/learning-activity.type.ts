export type ActivityType =
  | 'DAILY_LESSON'
  | 'DAILY_PRACTICE'
  | 'DAILY_TEST'
  | 'PHRASE_WRITE'
  | 'PHRASE_RECALL'
  | 'PHRASE_SPEAK';

export type ActivityStatus = 'COMPLETED' | 'IN_PROGRESS';

/** 0 = no activity, then 1 to 4 by how many kinds of activity the day has. */
export type Intensity = 0 | 1 | 2 | 3 | 4;

export interface DayActivity {
  /** `<date>:<type>`: one entry per kind of activity per day, so nothing is counted twice. */
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  status: ActivityStatus;
  /** ISO time with the +07:00 offset; null when the module does not record when. */
  occurredAt: string | null;
  /** A route that opens this activity; null while the module has none (it is then read-only). */
  targetUrl: string | null;
}

export interface CalendarDay {
  /** `YYYY-MM-DD` in Asia/Ho_Chi_Minh. */
  date: string;
  hasActivity: boolean;
  activityCount: number;
  intensity: Intensity;
}

/** One lesson's progress, as the aggregator needs it. */
export interface LessonProgressRow {
  /** The lesson's own date (`YYYY-MM-DD`); a lesson can only be done on that day. */
  date: string;
  dayNumber: number;
  learnCompleted: boolean;
  practiceCompleted: boolean;
  testCompleted: boolean;
  testScore: number | null;
  gateUnlocked: boolean;
  completedAt: Date | null;
}

export interface PhraseEvents {
  writes: Date[];
  recalls: { at: Date; grade: 'FORGOT' | 'HARD' | 'EASY' }[];
  spoken: { at: Date; containsPhrase: boolean }[];
}
