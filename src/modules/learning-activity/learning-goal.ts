/**
 * What the calendar says it is tracking. The Daily English vocabulary is the
 * "B2 Destination" book (see prisma/seeds/vocabulary-data.ts), so the goal is
 * B2 English. The level is not stored per user yet, so this is the single place
 * that names it; when users can pick a goal, this is what becomes data.
 */
export const LEARNING_GOAL = {
  language: 'English',
  level: 'B2',
  label: 'B2 English',
} as const;
