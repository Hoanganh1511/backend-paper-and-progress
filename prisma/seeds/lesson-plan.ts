// The 30-day plan of the Daily English Gate: 14 days of new units, 14 days of
// spaced review, then a full review and a final test.
// Run with node --experimental-strip-types, so keep to erasable TypeScript only.

export type LessonKind = 'NEW' | 'REVIEW' | 'FINAL_TEST';

export interface PlannedLesson {
  dayNumber: number;
  type: LessonKind;
  /** Book unit numbers (2, 4, ... 28), not database ids. */
  unitNumbers: number[];
}

const UNIT_NUMBERS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28];

const review = (dayNumber: number, unitNumbers: number[]): PlannedLesson => ({
  dayNumber,
  type: 'REVIEW',
  unitNumbers,
});

export const LESSON_PLAN: PlannedLesson[] = [
  // Days 1-14: one new unit a day
  ...UNIT_NUMBERS.map((unitNumber, index): PlannedLesson => ({
    dayNumber: index + 1,
    type: 'NEW',
    unitNumbers: [unitNumber],
  })),
  // Days 15-21: review in pairs, in the order they were learned
  review(15, [2, 4]),
  review(16, [6, 8]),
  review(17, [10, 12]),
  review(18, [14, 16]),
  review(19, [18, 20]),
  review(20, [22, 24]),
  review(21, [26, 28]),
  // Days 22-28: a second round, in groups of four
  review(22, [2, 4, 6, 8]),
  review(23, [10, 12, 14, 16]),
  review(24, [18, 20, 22, 24]),
  review(25, [26, 28, 2, 4]),
  review(26, [6, 8, 10, 12]),
  review(27, [14, 16, 18, 20]),
  review(28, [22, 24, 26, 28]),
  // Day 29: everything; day 30: the final test on everything
  review(29, UNIT_NUMBERS),
  { dayNumber: 30, type: 'FINAL_TEST', unitNumbers: UNIT_NUMBERS },
];
