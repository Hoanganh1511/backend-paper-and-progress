/**
 * Spaced repetition for the phrase notebook: when a phrase is due again and
 * which stage it is in. Pure functions; "today" is always passed in (it comes
 * from DailyGateService.today(), the same day boundary as the daily lessons).
 */

export type PhraseStageName = 'WRITE' | 'RECALL' | 'SPEAK' | 'MASTERED';
export type RecallGrade = 'FORGOT' | 'HARD' | 'EASY';

/** "Easy" this many times in a row, plus a spoken success, makes a phrase mastered. */
export const MASTERY_EASY_STREAK = 3;
/** First "Easy" (from an interval of 1 day or less) jumps to this many days. */
export const FIRST_EASY_DAYS = 3;

export interface ScheduleState {
  stage: PhraseStageName;
  intervalDays: number;
  easyStreak: number;
  speakPassed: boolean;
}

const DAY_MS = 86_400_000;

/** `today` is a UTC midnight (how `@db.Date` columns are compared); adds whole days. */
export const addDays = (today: Date, days: number) =>
  new Date(today.getTime() + days * DAY_MS);

/** Days until the next review after a grade. */
export function nextInterval(grade: RecallGrade, intervalDays: number): number {
  switch (grade) {
    case 'FORGOT':
      return 1;
    // ceil, not round: 1 -> 2 -> 3 -> 4 ..., rounding would stay at 1 forever.
    case 'HARD':
      return Math.max(1, Math.ceil(intervalDays * 1.2));
    case 'EASY':
      return intervalDays <= 1
        ? FIRST_EASY_DAYS
        : Math.ceil(intervalDays * 2.5);
  }
}

/** Stage after the first valid sentence (step 2). Later sentences change nothing. */
export const stageAfterWrite = (stage: PhraseStageName): PhraseStageName =>
  stage === 'WRITE' ? 'RECALL' : stage;

const isMastered = (speakPassed: boolean, easyStreak: number) =>
  speakPassed && easyStreak >= MASTERY_EASY_STREAK;

/** Applies a recall (step 3) to the schedule; `today` decides `nextReviewAt`. */
export function applyReview(
  state: ScheduleState,
  grade: RecallGrade,
  today: Date,
): ScheduleState & { nextReviewAt: Date } {
  const intervalDays = nextInterval(grade, state.intervalDays);
  const easyStreak = grade === 'EASY' ? state.easyStreak + 1 : 0;
  // Forgetting does not undo a spoken success.
  const speakPassed = state.speakPassed;

  let stage: PhraseStageName;
  if (grade === 'FORGOT') stage = 'RECALL';
  else if (isMastered(speakPassed, easyStreak)) stage = 'MASTERED';
  else if (!speakPassed) stage = 'SPEAK';
  else stage = 'RECALL';

  return {
    stage,
    intervalDays,
    easyStreak,
    speakPassed,
    nextReviewAt: addDays(today, intervalDays),
  };
}

/** A successful spoken attempt (step 4). The review date does not move. */
export function applySpeakPassed(state: ScheduleState): ScheduleState {
  return {
    ...state,
    speakPassed: true,
    stage: isMastered(true, state.easyStreak) ? 'MASTERED' : 'RECALL',
  };
}

/** The grades a user may pick given how the recall went. */
export function allowedGrades(options: {
  isAnswerCorrect: boolean;
  usedHint: boolean;
}): RecallGrade[] {
  if (!options.isAnswerCorrect) return ['FORGOT'];
  if (options.usedHint) return ['FORGOT', 'HARD'];
  return ['FORGOT', 'HARD', 'EASY'];
}

/**
 * Days in a row with activity, counting back from today, or from yesterday
 * when today has none yet. `days` are UTC-midnight dates, in any order.
 */
export function computeStreak(days: Date[], today: Date): number {
  const set = new Set(days.map((day) => day.getTime()));
  let cursor = today.getTime();
  if (!set.has(cursor)) cursor -= DAY_MS;
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}
