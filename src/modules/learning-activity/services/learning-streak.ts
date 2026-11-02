import { addDays } from './ict-date.js';

export interface Streaks {
  current: number;
  longest: number;
}

/**
 * Learning streaks from the days that have any activity. A day counts once
 * however many activities it had. The current streak runs back from today, or
 * from yesterday when today has none yet (the day is not over); the longest is
 * the best run in the whole history. Days after today never count.
 *
 * This is the overall learning streak. The Phrase Book keeps its own streak
 * (PhraseActivityDay) and is not changed by this.
 */
export function computeStreaks(days: Iterable<string>, today: string): Streaks {
  const active = new Set([...days].filter((day) => day <= today));
  if (active.size === 0) return { current: 0, longest: 0 };

  let current = 0;
  let cursor = active.has(today) ? today : addDays(today, -1);
  while (active.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  let previous: string | undefined;
  for (const day of [...active].sort()) {
    run = previous !== undefined && addDays(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return { current, longest };
}
