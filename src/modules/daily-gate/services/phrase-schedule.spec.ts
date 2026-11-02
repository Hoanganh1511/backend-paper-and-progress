import { describe, expect, it } from 'vitest';
import {
  addDays,
  allowedGrades,
  applyReview,
  applySpeakPassed,
  computeStreak,
  nextInterval,
  stageAfterWrite,
  type ScheduleState,
} from './phrase-schedule.js';

const TODAY = new Date('2026-11-05T00:00:00.000Z');
const day = (offset: number) => addDays(TODAY, offset);

const state = (overrides: Partial<ScheduleState> = {}): ScheduleState => ({
  stage: 'RECALL',
  intervalDays: 1,
  easyStreak: 0,
  speakPassed: false,
  ...overrides,
});

describe('nextInterval', () => {
  it('forgetting goes back to 1 day', () => {
    expect(nextInterval('FORGOT', 20)).toBe(1);
  });

  it('repeated "Hard" widens 1 -> 2 -> 3 -> 4 -> 5 (ceil, not round)', () => {
    const steps = [1];
    for (let i = 0; i < 4; i++) {
      steps.push(nextInterval('HARD', steps.at(-1) as number));
    }
    expect(steps).toEqual([1, 2, 3, 4, 5]);
  });

  it('the first "Easy" is 3 days, then it multiplies by 2.5', () => {
    expect(nextInterval('EASY', 1)).toBe(3);
    expect(nextInterval('EASY', 3)).toBe(8);
    expect(nextInterval('EASY', 8)).toBe(20);
  });
});

describe('stageAfterWrite', () => {
  it('moves WRITE on and leaves other stages alone', () => {
    expect(stageAfterWrite('WRITE')).toBe('RECALL');
    expect(stageAfterWrite('SPEAK')).toBe('SPEAK');
    expect(stageAfterWrite('MASTERED')).toBe('MASTERED');
  });
});

describe('applyReview', () => {
  it('forgetting returns to RECALL, resets the streak, keeps speakPassed', () => {
    const next = applyReview(
      state({
        stage: 'MASTERED',
        intervalDays: 20,
        easyStreak: 3,
        speakPassed: true,
      }),
      'FORGOT',
      TODAY,
    );
    expect(next).toMatchObject({
      stage: 'RECALL',
      intervalDays: 1,
      easyStreak: 0,
      speakPassed: true,
    });
    expect(next.nextReviewAt).toEqual(day(1));
  });

  it('a recall before speaking moves to SPEAK, Hard or Easy', () => {
    expect(applyReview(state(), 'HARD', TODAY).stage).toBe('SPEAK');
    expect(applyReview(state(), 'EASY', TODAY).stage).toBe('SPEAK');
  });

  it('after speaking, stays in RECALL until 3 Easy in a row, then MASTERED', () => {
    let current = state({ speakPassed: true });
    const stages: string[] = [];
    for (let i = 0; i < 3; i++) {
      const next = applyReview(current, 'EASY', TODAY);
      stages.push(next.stage);
      current = next;
    }
    expect(stages).toEqual(['RECALL', 'RECALL', 'MASTERED']);
  });

  it('Hard breaks the streak and a mastered phrase drops back to RECALL', () => {
    const next = applyReview(
      state({
        stage: 'MASTERED',
        intervalDays: 20,
        easyStreak: 3,
        speakPassed: true,
      }),
      'HARD',
      TODAY,
    );
    expect(next.stage).toBe('RECALL');
    expect(next.easyStreak).toBe(0);
    expect(next.intervalDays).toBe(24);
  });

  it('sets the next review date from today', () => {
    const next = applyReview(state(), 'EASY', TODAY);
    expect(next.nextReviewAt).toEqual(day(3));
  });
});

describe('applySpeakPassed', () => {
  it('goes to RECALL while the Easy streak is short', () => {
    expect(
      applySpeakPassed(state({ stage: 'SPEAK', easyStreak: 1 })),
    ).toMatchObject({
      stage: 'RECALL',
      speakPassed: true,
    });
  });

  it('goes straight to MASTERED when the streak is already 3', () => {
    expect(
      applySpeakPassed(state({ stage: 'SPEAK', easyStreak: 3 })).stage,
    ).toBe('MASTERED');
  });
});

describe('allowedGrades', () => {
  it('a wrong answer can only be "forgot"', () => {
    expect(allowedGrades({ isAnswerCorrect: false, usedHint: false })).toEqual([
      'FORGOT',
    ]);
  });

  it('a hint rules out "easy"', () => {
    expect(allowedGrades({ isAnswerCorrect: true, usedHint: true })).toEqual([
      'FORGOT',
      'HARD',
    ]);
  });

  it('a clean correct answer allows all three', () => {
    expect(
      allowedGrades({ isAnswerCorrect: true, usedHint: false }),
    ).toHaveLength(3);
  });
});

describe('computeStreak', () => {
  it('counts days in a row back from today', () => {
    expect(computeStreak([day(0), day(-1), day(-2), day(-4)], TODAY)).toBe(3);
  });

  it('keeps the streak alive until the end of today', () => {
    expect(computeStreak([day(-1), day(-2)], TODAY)).toBe(2);
  });

  it('is 0 after a missed day, or with no activity', () => {
    expect(computeStreak([day(-2), day(-3)], TODAY)).toBe(0);
    expect(computeStreak([], TODAY)).toBe(0);
  });
});
