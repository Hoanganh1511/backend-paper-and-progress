import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ENTRY_KINDS } from './dto/word-entry.dto.js';
import {
  toLearnWord,
  MAX_ENTRIES,
  SENTENCES_PER_WORD,
  DailyGateService,
  MIN_READY_WORDS,
} from './services/daily-gate.service.js';
import { QuizGeneratorService } from './services/quiz-generator.service.js';

const TODAY = '2026-11-05';
const lesson = {
  id: 5,
  dayNumber: 5,
  date: new Date(`${TODAY}T00:00:00.000Z`),
  type: 'NEW' as const,
  unitIds: [1],
  createdAt: new Date(0),
};

const progressRow = {
  id: 1,
  userId: 'u1',
  lessonId: 5,
  learnCompleted: false,
  practiceCompleted: false,
  testCompleted: false,
  testScore: null as number | null,
  bestScore: null as number | null,
  testAttempts: 0,
  gateUnlocked: false,
  completedAt: null,
};

function setup(
  options: {
    lesson?: typeof lesson | null;
    wordCount?: number;
    progress?: Partial<typeof progressRow>;
    first?: typeof lesson | null;
    last?: typeof lesson | null;
    entries?: { id: number; kind: string; text: string }[];
    /** Ids of the words marked "known". */
    known?: number[];
    counts?: { wordId: number; _count: { _all: number } }[];
    words?: { id: number; word: string }[];
  } = {},
) {
  const prisma = {
    dailyLesson: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          options.lesson === undefined ? lesson : options.lesson,
        ),
      findFirst: vi
        .fn()
        .mockImplementation(({ orderBy }: { orderBy: { dayNumber: string } }) =>
          Promise.resolve(
            orderBy.dayNumber === 'asc'
              ? (options.first ?? null)
              : (options.last ?? null),
          ),
        ),
    },
    userDailyProgress: {
      upsert: vi
        .fn()
        .mockResolvedValue({ ...progressRow, ...options.progress }),
      update: vi.fn().mockResolvedValue({ ...progressRow, gateUnlocked: true }),
    },
    wordReview: { createMany: vi.fn() },
    wordEntry: {
      findMany: vi.fn().mockResolvedValue(options.entries ?? []),
      groupBy: vi.fn().mockResolvedValue(options.counts ?? []),
      create: vi
        .fn()
        .mockImplementation(({ data }: { data: { text: string } }) =>
          Promise.resolve({ id: 99, ...data }),
        ),
      findFirst: vi.fn().mockResolvedValue(null),
      delete: vi.fn(),
    },
    wordMark: {
      findMany: vi
        .fn()
        .mockResolvedValue((options.known ?? []).map((wordId) => ({ wordId }))),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  const vocabulary = {
    countWords: vi.fn().mockResolvedValue(options.wordCount ?? 80),
    unitsByIds: vi
      .fn()
      .mockResolvedValue([
        { id: 1, unitNumber: 2, topic: 'Travel and transport' },
      ]),
    wordsOfUnits: vi.fn().mockResolvedValue(options.words ?? []),
  };
  const config = {
    get: vi.fn((key: string) =>
      key === 'DAILY_GATE_TODAY' ? TODAY : undefined,
    ),
  };
  const service = new DailyGateService(
    prisma as never,
    vocabulary as never,
    new QuizGeneratorService(),
    config as never,
  );
  return { service, prisma, vocabulary };
}

describe('DailyGateService.getToday', () => {
  it("gives today's lesson with the user's progress", async () => {
    const { service } = setup({ progress: { learnCompleted: true } });
    expect(await service.getToday('u1')).toMatchObject({
      active: true,
      lessonId: 5,
      dayNumber: 5,
      date: TODAY,
      type: 'NEW',
      isReady: true,
      learnedWords: 0,
      progress: { learnCompleted: true, gateUnlocked: false },
    });
  });

  it('counts the words that have all their sentences', async () => {
    const { service } = setup({
      counts: [
        { wordId: 1, _count: { _all: SENTENCES_PER_WORD } },
        { wordId: 2, _count: { _all: SENTENCES_PER_WORD - 1 } },
      ],
    });
    expect(await service.getToday('u1')).toMatchObject({ learnedWords: 1 });
  });

  it('says the lesson is not ready while its words are still to be written', async () => {
    const { service } = setup({ wordCount: MIN_READY_WORDS - 1 });
    expect(await service.getToday('u1')).toMatchObject({ isReady: false });
  });

  it('says why there is no lesson: before the first day, or after the last', async () => {
    const first = {
      ...lesson,
      dayNumber: 1,
      date: new Date('2026-11-10T00:00:00.000Z'),
    };
    const before = setup({ lesson: null, first, last: first });
    expect(await before.service.getToday('u1')).toEqual({
      active: false,
      reason: 'NOT_STARTED',
      startDate: '2026-11-10',
    });

    const last = {
      ...lesson,
      dayNumber: 30,
      date: new Date('2026-11-01T00:00:00.000Z'),
    };
    const after = setup({ lesson: null, first: last, last });
    expect(await after.service.getToday('u1')).toMatchObject({
      active: false,
      reason: 'FINISHED',
    });
  });
});

describe('DailyGateService order of steps', () => {
  it('asks for the lesson to be learned before practice', async () => {
    const { service } = setup({ progress: { learnCompleted: false } });
    await expect(service.getPractice('u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('asks for the practice to be done before the test', async () => {
    const { service } = setup({
      progress: { learnCompleted: true, practiceCompleted: false },
    });
    await expect(service.getTest('u1')).rejects.toThrow(BadRequestException);
    await expect(
      service.submitTest('u1', { lessonId: 5, answers: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  it("refuses a lesson id that is not today's", async () => {
    const { service } = setup();
    await expect(service.completeLearn('u1', { lessonId: 99 })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('DailyGateService.submitTest', () => {
  const done = { learnCompleted: true, practiceCompleted: true };

  it('does not mark the day as done on a score under 70%', async () => {
    const { service, prisma, vocabulary } = setup({ progress: done });
    // No words at all: no questions, so the score is 0 and the day is not done
    vocabulary.wordsOfUnits.mockResolvedValue([]);
    const failed = await service.submitTest('u1', { lessonId: 5, answers: [] });
    expect(failed.passed).toBe(false);
    expect(prisma.userDailyProgress.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ gateUnlocked: true }),
      }),
    );
  });

  it('does not lock the day again after it was passed', async () => {
    const { service, prisma } = setup({
      progress: { ...done, gateUnlocked: true, bestScore: 90 },
    });
    await service.submitTest('u1', { lessonId: 5, answers: [] });
    const data = prisma.userDailyProgress.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('gateUnlocked');
    expect(data.bestScore).toBe(90);
    expect(data.testAttempts).toEqual({ increment: 1 });
  });
});

describe('DailyGateService word entries', () => {
  it('has a list for each learning category, each with a limit', () => {
    expect(ENTRY_KINDS).toEqual([
      'SENTENCE',
      'COLLOCATION',
      'RELATED',
      'WORD_FAMILY',
      'PHRASAL_VERB',
      'WORD_PATTERN',
      'WORD_FORMATION',
      'DEPENDENT_PREPOSITION',
      'SYNONYM',
      'ANTONYM',
      'CONVERSATION',
    ]);
    for (const kind of ENTRY_KINDS) {
      expect(MAX_ENTRIES[kind]).toBeGreaterThan(0);
    }
  });

  it('takes the other categories as they are, without the word in them', async () => {
    for (const kind of ENTRY_KINDS) {
      if (kind === 'SENTENCE' || kind === 'COLLOCATION') continue;
      const { service, prisma } = setup({ words });
      await service.addEntry('u1', {
        lessonId: 5,
        wordId: 1,
        kind,
        text: 'something about another word',
      });
      expect(prisma.wordEntry.create.mock.calls[0][0].data.kind).toBe(kind);
    }
    // a sentence or a collocation still has to use the word
    const { service } = setup({ words });
    for (const kind of ['SENTENCE', 'COLLOCATION'] as const) {
      await expect(
        service.addEntry('u1', {
          lessonId: 5,
          wordId: 1,
          kind,
          text: 'something about another word',
        }),
      ).rejects.toThrow(BadRequestException);
    }
  });

  it('counts each kind apart, so twenty synonyms do not block antonyms', async () => {
    const synonyms = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      kind: 'SYNONYM',
      text: `synonym ${i}`,
    }));
    const { service } = setup({ words, entries: synonyms });
    await expect(
      service.addEntry('u1', {
        lessonId: 5,
        wordId: 1,
        kind: 'SYNONYM',
        text: 'one more',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.addEntry('u1', {
        lessonId: 5,
        wordId: 1,
        kind: 'ANTONYM',
        text: 'opposite',
      }),
    ).resolves.toHaveProperty('entries');
  });

  it('keeps up to 20 collocations and 20 related words per word', async () => {
    expect(MAX_ENTRIES.COLLOCATION).toBe(20);
    expect(MAX_ENTRIES.RELATED).toBe(20);
    expect(MAX_ENTRIES.SENTENCE).toBe(SENTENCES_PER_WORD);
  });

  const words = [
    { id: 1, word: 'voyage' },
    { id: 2, word: 'catch up with' },
  ];

  it('keeps a sentence that uses the word', async () => {
    const { service, prisma } = setup({ words });
    const result = await service.addEntry('u1', {
      lessonId: 5,
      wordId: 1,
      text: ' The voyage was long. ',
    });
    expect(prisma.wordEntry.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        lessonId: 5,
        wordId: 1,
        kind: 'SENTENCE',
        text: 'The voyage was long.',
      },
    });
    expect(result.entries.at(-1)).toMatchObject({
      kind: 'SENTENCE',
      text: 'The voyage was long.',
    });
  });

  it('refuses a sentence without the word, a repeat, and a word of another lesson', async () => {
    const { service } = setup({
      words,
      entries: [{ id: 1, kind: 'SENTENCE', text: 'The voyage was long.' }],
    });
    const add = (wordId: number, text: string) =>
      service.addEntry('u1', { lessonId: 5, wordId, text });
    await expect(add(1, 'I like tea.')).rejects.toThrow(BadRequestException);
    await expect(add(1, 'the  VOYAGE was long.')).rejects.toThrow(
      BadRequestException,
    );
    await expect(add(7, 'A voyage.')).rejects.toThrow(BadRequestException);
  });

  it('keeps collocations that use the word, and related words that do not', async () => {
    const { service, prisma } = setup({ words });
    await service.addEntry('u1', {
      lessonId: 5,
      wordId: 1,
      kind: 'COLLOCATION',
      text: 'a long voyage',
    });
    expect(prisma.wordEntry.create.mock.calls[0][0].data.kind).toBe(
      'COLLOCATION',
    );
    await expect(
      service.addEntry('u1', {
        lessonId: 5,
        wordId: 1,
        kind: 'COLLOCATION',
        text: 'a short trip',
      }),
    ).rejects.toThrow(BadRequestException);

    await service.addEntry('u1', {
      lessonId: 5,
      wordId: 1,
      kind: 'RELATED',
      text: 'journey, trip',
    });
    expect(prisma.wordEntry.create.mock.calls[1][0].data).toMatchObject({
      kind: 'RELATED',
      text: 'journey, trip',
    });
  });

  it('counts each kind on its own: a full list of sentences does not block collocations', async () => {
    const sentences = Array.from({ length: SENTENCES_PER_WORD }, (_, i) => ({
      id: i + 1,
      kind: 'SENTENCE',
      text: `Voyage number ${i}.`,
    }));
    const { service } = setup({ words, entries: sentences });
    await expect(
      service.addEntry('u1', { lessonId: 5, wordId: 1, text: 'My voyage.' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.addEntry('u1', {
        lessonId: 5,
        wordId: 1,
        kind: 'COLLOCATION',
        text: 'a long voyage',
      }),
    ).resolves.toHaveProperty('entries');
  });

  it('counts a word as learned when it has all its sentences or is marked known, not otherwise', async () => {
    const short = setup({
      words,
      counts: [
        { wordId: 1, _count: { _all: SENTENCES_PER_WORD } },
        { wordId: 2, _count: { _all: SENTENCES_PER_WORD - 1 } },
      ],
    });
    await expect(
      short.service.completeLearn('u1', { lessonId: 5 }),
    ).rejects.toThrow(BadRequestException);
    expect(short.prisma.userDailyProgress.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({ update: { learnCompleted: true } }),
    );

    // the second word is known, not written about
    const mixed = setup({
      words,
      counts: [{ wordId: 1, _count: { _all: SENTENCES_PER_WORD } }],
      known: [2],
    });
    await expect(
      mixed.service.completeLearn('u1', { lessonId: 5 }),
    ).resolves.toHaveProperty('progress');

    // only the sentences count, so collocations alone do not finish a word
    expect(short.prisma.wordEntry.groupBy.mock.calls[0][0].where).toMatchObject(
      { kind: 'SENTENCE' },
    );
  });

  it('stores and clears the mark of a word of today', async () => {
    const { service, prisma } = setup({ words });
    await service.setMark('u1', { lessonId: 5, wordId: 1, mark: 'known' });
    expect(prisma.wordMark.upsert.mock.calls[0][0]).toMatchObject({
      create: { userId: 'u1', wordId: 1, mark: 'KNOWN' },
      update: { mark: 'KNOWN' },
    });
    await service.setMark('u1', { lessonId: 5, wordId: 1, mark: null });
    expect(prisma.wordMark.deleteMany).toHaveBeenCalledTimes(1);
    await expect(
      service.setMark('u1', { lessonId: 5, wordId: 9, mark: 'known' }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('toLearnWord', () => {
  const row = (over: Record<string, unknown> = {}) =>
    ({
      id: 1,
      unitId: 2,
      section: 'TOPIC_CONTRAST',
      word: 'artificial',
      meaning: 'made by people',
      example: null,
      contrast: 'natural',
      forms: null,
      pattern: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      pronunciation: '/aa/',
      partsOfSpeech: ['adjective'],
      level: 'B2',
      topics: ['Công nghệ'],
      meaningVi: 'nhân tạo',
      wordFamily: [],
      collocations: [],
      phrasalVerbs: [],
      wordPatterns: [],
      wordFormation: [],
      dependentPrepositions: [],
      synonyms: [],
      antonyms: [],
      relatedVocabulary: [],
      conversations: [],
      ...over,
    }) as never;

  it('gives the lesson the card fields and the kind of word', () => {
    expect(toLearnWord(row())).toMatchObject({
      id: 1,
      word: 'artificial',
      contrast: 'natural',
      pronunciation: '/aa/',
      partsOfSpeech: ['adjective'],
      level: 'B2',
      topics: ['Công nghệ'],
      meaningVi: 'nhân tạo',
    });
  });

  it('sends only the categories that have items, in the order they were saved', () => {
    const word = toLearnWord(
      row({
        synonyms: [
          { id: 'b', word: 'fake' },
          { id: 'a', word: 'man-made' },
        ],
        collocations: [{ id: 'c', phrase: 'artificial intelligence' }],
      }),
    );
    expect(Object.keys(word.content)).toEqual(['collocations', 'synonyms']);
    expect(
      (word.content.synonyms as { id: string }[]).map((i) => i.id),
    ).toEqual(['b', 'a']);
  });

  it('costs nothing for a word seeded without the new fields', () => {
    expect(toLearnWord(row({ meaningVi: null, level: null })).content).toEqual(
      {},
    );
  });

  it('does not trust a column that is not a list', () => {
    expect(toLearnWord(row({ synonyms: { broken: true } })).content).toEqual(
      {},
    );
  });
});
