import { describe, expect, it } from 'vitest';
import type { VocabularyWord } from '@prisma/client';
import { SECTIONS, UNITS } from '../../../../prisma/seeds/vocabulary-data.ts';
import {
  QuizGeneratorService,
  blankOut,
  firstForm,
  hashSeed,
} from './quiz-generator.service.js';

// The real word lists, as the database rows they become.
const words: VocabularyWord[] = UNITS.flatMap((unit) =>
  SECTIONS.flatMap((section) =>
    unit.sections[section].map((entry) => ({
      section,
      word: entry.word,
      meaning: entry.meaning,
      example: entry.example,
      contrast: entry.contrast ?? null,
      forms: entry.forms ?? null,
      pattern: entry.pattern ?? null,
      unitId: unit.unitNumber,
      createdAt: new Date(0),
    })),
  ),
).map((word, index) => ({ ...word, id: index + 1 }));

const unit2 = words.filter((word) => word.unitId === 2);
const quiz = new QuizGeneratorService();

describe('hashSeed', () => {
  it('is stable and depends on every part', () => {
    expect(hashSeed('test', 'u1', 5, 0)).toBe(hashSeed('test', 'u1', 5, 0));
    expect(hashSeed('test', 'u1', 5, 0)).not.toBe(hashSeed('test', 'u1', 5, 1));
    expect(hashSeed('test', 'u1', 5, 0)).not.toBe(hashSeed('test', 'u2', 5, 0));
  });
});

describe('practice questions', () => {
  const questions = quiz.generatePractice(unit2, 1);

  it('make 5 matching, 5 fill-in-the-blank and 5 contrast questions', () => {
    const count = (type: string) =>
      questions.filter((q) => q.type === type).length;
    expect(questions).toHaveLength(15);
    expect(count('MATCHING')).toBe(5);
    expect(count('FILL_BLANK')).toBe(5);
    expect(count('CHOOSE_CONTRAST')).toBe(5);
  });

  it('are the same for the same seed, and different for another', () => {
    expect(quiz.generatePractice(unit2, 1)).toEqual(questions);
    expect(quiz.generatePractice(unit2, 2)).not.toEqual(questions);
  });

  it('keep the matching answer key consistent with the shuffled meanings', () => {
    for (const question of questions) {
      if (question.type !== 'MATCHING') continue;
      expect(question.left).toHaveLength(4);
      question.left.forEach((left, index) => {
        const word = words.find((w) => w.id === question.wordIds[index]);
        expect(word?.word).toBe(left);
        expect(question.right[question.answer[index]]).toBe(word?.meaning);
      });
    }
  });

  it('put the correct word among four options and blank it out of the sentence', () => {
    for (const question of questions) {
      if (question.type === 'MATCHING') continue;
      const word = words.find((w) => w.id === question.wordId);
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options).size).toBe(4);
      expect(question.options[question.correctIndex]).toBe(word?.word);
      expect(question.sentence).toContain('_____');
      expect(question.sentence.toLowerCase()).not.toContain(
        ` ${word?.word.toLowerCase()} `,
      );
    }
  });
});

describe('test questions', () => {
  it('are 10 multiple choice questions with four different options', () => {
    const questions = quiz.generateTest(unit2, 7, 10);
    expect(questions).toHaveLength(10);
    for (const question of questions) {
      expect(question.options.length).toBeGreaterThanOrEqual(2);
      expect(new Set(question.options).size).toBe(question.options.length);
      expect(question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctIndex).toBeLessThan(question.options.length);
    }
  });

  it('mix meaning, context, word formation and pattern questions', () => {
    const text = quiz
      .generateTest(unit2, 7, 12)
      .map((question) => question.question)
      .join('\n');
    expect(text).toMatch(/What does/);
    expect(text).toMatch(/completes the sentence/);
    expect(text).toMatch(/formed from/);
    expect(text).toMatch(/Which pattern/);
  });

  it('are repeatable for a seed, and new for the next attempt', () => {
    const first = quiz.generateTest(unit2, hashSeed('test', 'u', 1, 0), 10);
    expect(quiz.generateTest(unit2, hashSeed('test', 'u', 1, 0), 10)).toEqual(
      first,
    );
    expect(
      quiz.generateTest(unit2, hashSeed('test', 'u', 1, 1), 10),
    ).not.toEqual(first);
  });

  it('never put the answer in what the client receives', () => {
    const questions = quiz.generateTest(unit2, 3, 10);
    const sent = JSON.stringify(quiz.toPublicTest(questions));
    expect(sent).not.toContain('correctIndex');
    expect(sent).not.toContain('explanation');
    expect(sent).not.toContain('wordId');
  });

  it('make a 30-question final test from several units', () => {
    expect(quiz.generateTest(words, 1, 30)).toHaveLength(30);
  });

  it('make no questions when there are no words', () => {
    expect(quiz.generateTest([], 1, 10)).toEqual([]);
    expect(quiz.generatePractice([], 1)).toEqual([]);
  });
});

describe('grading', () => {
  it('scores a test by the share of right answers', () => {
    const questions = quiz.generateTest(unit2, 5, 10);
    const allRight = questions.map((q) => ({
      questionId: q.id,
      answer: q.correctIndex,
    }));
    expect(quiz.gradeTest(questions, allRight).score).toBe(100);

    const sevenRight = questions.map((q, index) => ({
      questionId: q.id,
      answer:
        index < 7 ? q.correctIndex : (q.correctIndex + 1) % q.options.length,
    }));
    const graded = quiz.gradeTest(questions, sevenRight);
    expect(graded.score).toBe(70);
    expect(graded.results.filter((r) => r.correct)).toHaveLength(7);

    expect(quiz.gradeTest(questions, []).score).toBe(0);
  });

  it('records a review for every word asked', () => {
    const questions = quiz.generateTest(unit2, 5, 10);
    const graded = quiz.gradeTest(questions, []);
    expect(graded.reviews).toHaveLength(10);
    expect(graded.reviews.every((review) => review.correct === false)).toBe(
      true,
    );
  });

  it('gives a matching question part credit for each pair', () => {
    const questions = quiz.generatePractice(unit2, 1);
    const matching = questions.find((q) => q.type === 'MATCHING');
    if (matching?.type !== 'MATCHING') throw new Error('no matching question');

    const half = matching.answer.map((value, index) =>
      index < 2 ? value : -1,
    );
    const graded = quiz.gradePractice(questions, [
      { questionId: matching.id, answer: half },
    ]);
    const detail = graded.details.find((d) => d.questionId === matching.id);
    expect(detail?.points).toBeCloseTo(0.5);
    expect(detail?.correct).toBe(false);
  });

  it('scores a perfect practice as 100', () => {
    const questions = quiz.generatePractice(unit2, 1);
    const answers = questions.map((q) => ({
      questionId: q.id,
      answer: q.type === 'MATCHING' ? q.answer : q.correctIndex,
    }));
    expect(quiz.gradePractice(questions, answers).score).toBe(100);
  });
});

describe('helpers', () => {
  it('blanks out only the whole word', () => {
    expect(blankOut('We stay at a hotel and stayed late.', 'stay')).toBe(
      'We _____ at a hotel and stayed late.',
    );
  });

  it('takes the first derived word', () => {
    expect(firstForm('breadth (noun); broaden (verb)')).toBe('breadth');
    expect(firstForm('arrival (noun)')).toBe('arrival');
  });
});
