import { Injectable } from '@nestjs/common';
import type { VocabularyWord, VocabSection } from '@prisma/client';
import type {
  ChoiceQuestion,
  MatchingQuestion,
  PracticeAnswer,
  PracticeQuestion,
  PublicTestQuestion,
  SubmittedAnswer,
  TestQuestion,
  WordResult,
} from '../types/quiz.types.js';

export const PRACTICE_PER_TYPE = 5;
export const MATCH_PAIRS = 4;
const BLANK = '_____';

/* -------------------------------------------------------------------------- */
/* Seeded randomness: the same seed always gives the same questions, so the    */
/* server can rebuild them to grade, and never has to send the answers.        */
/* -------------------------------------------------------------------------- */

export function hashSeed(...parts: (string | number)[]): number {
  let hash = 2166136261;
  for (const char of parts.join(':')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

type Random = () => number;

function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* Helpers on words                                                           */
/* -------------------------------------------------------------------------- */

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wordRegExp = (word: string) =>
  new RegExp(`(?<![\\w])${escapeRegExp(word)}(?![\\w])`, 'i');

/** True when the example holds the word exactly, so it can be blanked out. */
export const canBlank = (word: VocabularyWord) =>
  Boolean(word.example && wordRegExp(word.word).test(word.example));

export const blankOut = (example: string, word: string) =>
  example.replace(wordRegExp(word), BLANK);

/** The first derived word of `forms`: "breadth (noun); broaden (verb)" gives "breadth". */
export const firstForm = (forms: string) =>
  forms
    .split(/[;,]/)[0]
    .replace(/\(.*?\)/g, '')
    .trim();

const contrastMembers = (contrast: string) =>
  contrast
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

const bySection = (words: VocabularyWord[], ...sections: VocabSection[]) =>
  words.filter((word) => sections.includes(word.section));

/** Up to `count` values other than `correct`, no repeats. */
function distractors(
  correct: string,
  pool: string[],
  count: number,
  random: Random,
): string[] {
  const unique = [...new Set(pool)].filter((value) => value !== correct);
  return shuffle(unique, random).slice(0, count);
}

/** Puts the correct option in a random place; returns the options and where it went. */
function placeCorrect(
  correct: string,
  wrong: string[],
  random: Random,
): { options: string[]; correctIndex: number } {
  const options = shuffle([correct, ...wrong], random);
  return { options, correctIndex: options.indexOf(correct) };
}

/** Takes words from `candidates`, first the ones not used yet. */
function pickWords(
  candidates: VocabularyWord[],
  count: number,
  used: Set<number>,
  random: Random,
): VocabularyWord[] {
  const fresh = shuffle(
    candidates.filter((word) => !used.has(word.id)),
    random,
  );
  const picked = fresh.slice(0, count);
  if (picked.length < count) {
    const rest = shuffle(
      candidates.filter((word) => !picked.includes(word)),
      random,
    );
    picked.push(...rest.slice(0, count - picked.length));
  }
  for (const word of picked) used.add(word.id);
  return picked;
}

const explain = (word: VocabularyWord) =>
  word.contrast
    ? `"${word.word}": ${word.meaning}. Compare: ${word.contrast}.`
    : `"${word.word}": ${word.meaning}.`;

/* -------------------------------------------------------------------------- */

@Injectable()
export class QuizGeneratorService {
  /** 5 matching, 5 fill-in-the-blank and 5 "choose the right word of a confusing group". */
  generatePractice(words: VocabularyWord[], seed: number): PracticeQuestion[] {
    const random = createRandom(seed);
    const used = new Set<number>();
    const questions: PracticeQuestion[] = [];
    let id = 1;

    // MATCHING: four words of one section against their meanings.
    const matchSections: VocabSection[][] = [
      ['PHRASAL_VERB'],
      ['PHRASE_COLLOCATION'],
      ['TOPIC_CONTRAST'],
      ['WORD_PATTERN', 'WORD_FORMATION'],
      ['PHRASAL_VERB', 'PHRASE_COLLOCATION'],
    ];
    for (let i = 0; i < PRACTICE_PER_TYPE; i += 1) {
      let candidates = bySection(words, ...matchSections[i]);
      if (candidates.length < MATCH_PAIRS) candidates = words;
      if (candidates.length < MATCH_PAIRS) break;
      const picked = pickWords(candidates, MATCH_PAIRS, used, random);
      const rightOrder = shuffle(
        picked.map((_, index) => index),
        random,
      );
      const question: MatchingQuestion = {
        id: id++,
        type: 'MATCHING',
        instruction: 'Match each word or phrase with its meaning',
        left: picked.map((word) => word.word),
        right: rightOrder.map((index) => picked[index].meaning),
        // left[i] has its meaning at the place where rightOrder holds i
        answer: picked.map((_, index) => rightOrder.indexOf(index)),
        wordIds: picked.map((word) => word.id),
      };
      questions.push(question);
    }

    // FILL_BLANK: a sentence with the word taken out.
    const blankable = words.filter(
      (word) =>
        canBlank(word) &&
        (word.section === 'PHRASAL_VERB' ||
          word.section === 'PHRASE_COLLOCATION' ||
          word.section === 'TOPIC_CONTRAST'),
    );
    for (const word of pickWords(blankable, PRACTICE_PER_TYPE, used, random)) {
      const sameSection = bySection(words, word.section).map((w) => w.word);
      const { options, correctIndex } = placeCorrect(
        word.word,
        distractors(word.word, sameSection, 3, random),
        random,
      );
      const question: ChoiceQuestion = {
        id: id++,
        type: 'FILL_BLANK',
        instruction: 'Complete the sentence with the correct word or phrase',
        sentence: blankOut(word.example as string, word.word),
        options,
        correctIndex,
        explanation: explain(word),
        wordId: word.id,
      };
      questions.push(question);
    }

    // CHOOSE_CONTRAST: one word out of a group that is easy to mix up.
    const contrasts = words.filter((word) => word.contrast && canBlank(word));
    for (const word of pickWords(contrasts, PRACTICE_PER_TYPE, used, random)) {
      const members = contrastMembers(word.contrast as string);
      const others = [
        ...members,
        ...bySection(words, 'TOPIC_CONTRAST').map((w) => w.word),
      ];
      const { options, correctIndex } = placeCorrect(
        word.word,
        distractors(word.word, others, 3, random),
        random,
      );
      const question: ChoiceQuestion = {
        id: id++,
        type: 'CHOOSE_CONTRAST',
        instruction: 'Choose the correct word',
        sentence: blankOut(word.example as string, word.word),
        options,
        correctIndex,
        explanation: explain(word),
        wordId: word.id,
      };
      questions.push(question);
    }

    return questions;
  }

  /** `count` multiple-choice questions that mix meaning, context, word formation and patterns. */
  generateTest(
    words: VocabularyWord[],
    seed: number,
    count: number,
  ): TestQuestion[] {
    const random = createRandom(seed);
    const used = new Set<number>();
    const meaningWords = words.filter((word) =>
      ['PHRASAL_VERB', 'PHRASE_COLLOCATION', 'TOPIC_CONTRAST'].includes(
        word.section,
      ),
    );
    const blankable = meaningWords.filter(canBlank);
    const formation = bySection(words, 'WORD_FORMATION').filter(
      (word) => word.forms,
    );
    const patterns = bySection(words, 'WORD_PATTERN').filter(
      (word) => word.pattern,
    );

    type Kind = 'MEANING' | 'BLANK' | 'FORMATION' | 'PATTERN';
    const pools: Record<Kind, VocabularyWord[]> = {
      MEANING: meaningWords,
      BLANK: blankable,
      FORMATION: formation,
      PATTERN: patterns,
    };
    const rotation = (
      ['MEANING', 'BLANK', 'FORMATION', 'BLANK', 'PATTERN', 'MEANING'] as Kind[]
    ).filter((kind) => pools[kind].length > 0);
    if (rotation.length === 0) return [];

    const questions: TestQuestion[] = [];
    for (let index = 0; index < count; index += 1) {
      const kind = rotation[index % rotation.length];
      const [word] = pickWords(pools[kind], 1, used, random);
      if (!word) continue;
      const id = questions.length + 1;

      if (kind === 'MEANING') {
        const { options, correctIndex } = placeCorrect(
          word.meaning,
          distractors(
            word.meaning,
            bySection(words, word.section).map((w) => w.meaning),
            3,
            random,
          ),
          random,
        );
        questions.push({
          id,
          type: 'MULTIPLE_CHOICE',
          question: `What does "${word.word}" mean?`,
          options,
          correctIndex,
          wordId: word.id,
          explanation: explain(word),
        });
      } else if (kind === 'BLANK') {
        const group = word.contrast ? contrastMembers(word.contrast) : [];
        const sameSection = bySection(words, word.section).map((w) => w.word);
        const { options, correctIndex } = placeCorrect(
          word.word,
          distractors(word.word, [...group, ...sameSection], 3, random),
          random,
        );
        questions.push({
          id,
          type: 'MULTIPLE_CHOICE',
          question: `Choose the word or phrase that completes the sentence: ${blankOut(word.example as string, word.word)}`,
          options,
          correctIndex,
          wordId: word.id,
          explanation: explain(word),
        });
      } else if (kind === 'FORMATION') {
        const correct = firstForm(word.forms as string);
        const { options, correctIndex } = placeCorrect(
          correct,
          distractors(
            correct,
            formation.map((w) => firstForm(w.forms as string)),
            3,
            random,
          ),
          random,
        );
        questions.push({
          id,
          type: 'MULTIPLE_CHOICE',
          question: `Which word is formed from "${word.word}"?`,
          options,
          correctIndex,
          wordId: word.id,
          explanation: `"${word.word}" gives ${word.forms}.`,
        });
      } else {
        const correct = word.pattern as string;
        const { options, correctIndex } = placeCorrect(
          correct,
          distractors(
            correct,
            patterns.map((w) => w.pattern as string),
            3,
            random,
          ),
          random,
        );
        questions.push({
          id,
          type: 'MULTIPLE_CHOICE',
          question: `Which pattern is used with "${word.word}"?`,
          options,
          correctIndex,
          wordId: word.id,
          explanation: `"${word.word}": ${correct}.`,
        });
      }
    }
    return questions;
  }

  /** The test as the client may see it: no answers. */
  toPublicTest(questions: TestQuestion[]): PublicTestQuestion[] {
    return questions.map(({ id, type, question, options }) => ({
      id,
      type,
      question,
      options,
    }));
  }

  /* ------------------------------------------------------------------------ */
  /* Grading                                                                  */
  /* ------------------------------------------------------------------------ */

  /** A matching question is worth the share of pairs the user got right. */
  gradePractice(
    questions: PracticeQuestion[],
    submitted: SubmittedAnswer<PracticeAnswer>[],
  ) {
    const answers = new Map(submitted.map((item) => [item.questionId, item]));
    const reviews: WordResult[] = [];
    const details = questions.map((question) => {
      const given = answers.get(question.id)?.answer;
      let points = 0;
      if (question.type === 'MATCHING') {
        const chosen = Array.isArray(given) ? given : [];
        question.answer.forEach((expected, index) => {
          const correct = chosen[index] === expected;
          if (correct) points += 1 / question.answer.length;
          reviews.push({ wordId: question.wordIds[index], correct });
        });
      } else {
        const correct = given === question.correctIndex;
        points = correct ? 1 : 0;
        reviews.push({ wordId: question.wordId, correct });
      }
      return {
        questionId: question.id,
        correct: Math.abs(points - 1) < 1e-9,
        points,
        correctAnswer:
          question.type === 'MATCHING'
            ? question.answer
            : question.correctIndex,
        yourAnswer: given ?? null,
        explanation:
          question.type === 'MATCHING' ? undefined : question.explanation,
      };
    });
    const total = details.reduce((sum, detail) => sum + detail.points, 0);
    return {
      score: questions.length
        ? Math.round((total / questions.length) * 100)
        : 0,
      details,
      reviews,
    };
  }

  gradeTest(questions: TestQuestion[], submitted: SubmittedAnswer<number>[]) {
    const answers = new Map(
      submitted.map((item) => [item.questionId, item.answer]),
    );
    const results = questions.map((question) => {
      const given = answers.get(question.id);
      return {
        questionId: question.id,
        correct: given === question.correctIndex,
        correctAnswer: question.correctIndex,
        yourAnswer: given ?? null,
        explanation: question.explanation,
        wordId: question.wordId,
      };
    });
    const right = results.filter((result) => result.correct).length;
    return {
      score: questions.length
        ? Math.round((right / questions.length) * 100)
        : 0,
      results,
      reviews: results.map((result): WordResult => ({
        wordId: result.wordId,
        correct: result.correct,
      })),
    };
  }
}
