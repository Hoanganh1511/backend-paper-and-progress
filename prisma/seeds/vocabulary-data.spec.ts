import { describe, expect, it } from 'vitest';
import { SECTIONS, UNITS } from './vocabulary-data.ts';
import { LESSON_PLAN } from './lesson-plan.ts';

describe('vocabulary data', () => {
  const filled = UNITS.filter((unit) =>
    SECTIONS.some((section) => unit.sections[section].length > 0),
  );

  it('lists the 14 units of the book, two apart', () => {
    expect(UNITS.map((unit) => unit.unitNumber)).toEqual([
      2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28,
    ]);
  });

  it('has words in all five sections of the units that are written', () => {
    expect(filled.map((unit) => unit.unitNumber)).toEqual([2, 4, 6, 8]);
    for (const unit of filled) {
      for (const section of SECTIONS) {
        expect(
          unit.sections[section].length,
          `${unit.topic} / ${section}`,
        ).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it('gives every word a meaning and an example', () => {
    for (const unit of filled) {
      for (const section of SECTIONS) {
        for (const entry of unit.sections[section]) {
          expect(entry.meaning.length, entry.word).toBeGreaterThan(3);
          expect(entry.example.length, entry.word).toBeGreaterThan(10);
        }
      }
    }
  });

  it('keeps each example usable for a blank: it holds the word as a whole word', () => {
    for (const unit of filled) {
      for (const section of [
        'TOPIC_CONTRAST',
        'PHRASAL_VERB',
        'PHRASE_COLLOCATION',
      ] as const) {
        for (const entry of unit.sections[section]) {
          const pattern = new RegExp(`(?<![\\w])${entry.word}(?![\\w])`, 'i');
          expect(entry.example, `${unit.topic}: ${entry.word}`).toMatch(
            pattern,
          );
        }
      }
    }
  });

  it('gives confusing-word groups their other members, and word formation its forms', () => {
    for (const unit of filled) {
      for (const entry of unit.sections.TOPIC_CONTRAST) {
        expect(entry.contrast, entry.word).toBeTruthy();
      }
      for (const entry of unit.sections.WORD_FORMATION) {
        expect(entry.forms, entry.word).toBeTruthy();
      }
      for (const entry of unit.sections.WORD_PATTERN) {
        expect(entry.pattern, entry.word).toBeTruthy();
      }
    }
  });

  it('has no word twice in one section of a unit', () => {
    for (const unit of filled) {
      for (const section of SECTIONS) {
        const names = unit.sections[section].map((entry) => entry.word);
        expect(new Set(names).size, `${unit.topic} / ${section}`).toBe(
          names.length,
        );
      }
    }
  });
});

describe('lesson plan', () => {
  it('runs for 30 days in order', () => {
    expect(LESSON_PLAN.map((lesson) => lesson.dayNumber)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
  });

  it('has 14 new days, 14 review days, a full review and a final test', () => {
    const count = (type: string) =>
      LESSON_PLAN.filter((l) => l.type === type).length;
    expect(count('NEW')).toBe(14);
    expect(count('REVIEW')).toBe(15);
    expect(count('FINAL_TEST')).toBe(1);
    expect(LESSON_PLAN[29].type).toBe('FINAL_TEST');
    expect(LESSON_PLAN[29].unitNumbers).toHaveLength(14);
  });

  it('teaches each unit once on its own day, and only reviews units already learned', () => {
    const learned = new Set<number>();
    for (const lesson of LESSON_PLAN) {
      if (lesson.type === 'NEW') {
        expect(lesson.unitNumbers).toHaveLength(1);
        learned.add(lesson.unitNumbers[0]);
      } else {
        for (const unit of lesson.unitNumbers) {
          expect(
            learned.has(unit),
            `day ${lesson.dayNumber} reviews unit ${unit}`,
          ).toBe(true);
        }
      }
    }
    expect(learned.size).toBe(14);
  });

  it('follows the planned reviews', () => {
    const day = (n: number) => LESSON_PLAN[n - 1].unitNumbers;
    expect(day(15)).toEqual([2, 4]);
    expect(day(21)).toEqual([26, 28]);
    expect(day(22)).toEqual([2, 4, 6, 8]);
    expect(day(25)).toEqual([26, 28, 2, 4]);
    expect(day(28)).toEqual([22, 24, 26, 28]);
  });
});
