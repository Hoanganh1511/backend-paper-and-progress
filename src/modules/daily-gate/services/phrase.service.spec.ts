import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, type PhraseStage } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PhraseService } from './phrase.service.js';

const TODAY = new Date('2026-11-05T00:00:00.000Z');

const phraseRow = {
  id: 'p1',
  userId: 'u1',
  wordId: null,
  phrase: 'meet a deadline',
  phraseNormalized: 'meet a deadline',
  meaning: 'kịp hạn chót',
  sampleSentence: 'We must meet the deadline.',
  stage: 'RECALL' as PhraseStage,
  intervalDays: 1,
  nextReviewAt: TODAY,
  easyStreak: 0,
  speakPassed: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

function setup(
  phrase: Partial<typeof phraseRow> = {},
  examples: string[] = [],
) {
  const row = { ...phraseRow, ...phrase };
  const prisma = {
    phrase: {
      findFirst: vi.fn().mockResolvedValue(row),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue(row),
    },
    phraseExample: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
      findMany: vi.fn().mockResolvedValue(examples.map((text) => ({ text }))),
    },
    phraseSpokenAttempt: { create: vi.fn().mockResolvedValue({ id: 1 }) },
    phraseReview: { create: vi.fn().mockResolvedValue({ id: 1 }) },
    phraseActivityDay: { upsert: vi.fn().mockResolvedValue({}) },
    vocabularyWord: { findUnique: vi.fn() },
    $transaction: vi.fn((operations: unknown[]) => Promise.all(operations)),
  };
  const dailyGate = { today: () => TODAY };
  const service = new PhraseService(prisma as never, dailyGate as never);
  return { service, prisma };
}

describe('create', () => {
  it('rejects a duplicate phrase with 409', async () => {
    const { service, prisma } = setup();
    prisma.phrase.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.create('u1', { phrase: 'Meet a deadline ', meaning: 'x' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('stores a normalised key and flags a single word', async () => {
    const { service, prisma } = setup();
    const result = await service.create('u1', {
      phrase: '  Deadline ',
      meaning: 'hạn chót',
    });
    expect(prisma.phrase.create.mock.calls[0][0].data).toMatchObject({
      phrase: 'Deadline',
      phraseNormalized: 'deadline',
      nextReviewAt: TODAY,
    });
    expect(result.isSingleWord).toBe(true);
  });

  it('takes the lesson example as the sample sentence', async () => {
    const { service, prisma } = setup();
    prisma.vocabularyWord.findUnique.mockResolvedValue({
      id: 7,
      example: 'I met the deadline.',
    });
    await service.create('u1', {
      phrase: 'meet a deadline',
      meaning: 'x',
      wordId: 7,
    });
    expect(prisma.phrase.create.mock.calls[0][0].data.sampleSentence).toBe(
      'I met the deadline.',
    );
  });
});

describe('list', () => {
  it('"due" leaves out phrases that have no sentence yet', async () => {
    const { service, prisma } = setup();
    await service.list('u1', { due: 'true' });
    expect(prisma.phrase.findMany.mock.calls[0][0].where).toEqual({
      userId: 'u1',
      stage: { not: 'WRITE' },
      nextReviewAt: { lte: TODAY },
    });
  });
});

describe('addExample (step 2)', () => {
  it('rejects a sentence without the phrase', async () => {
    const { service } = setup({ stage: 'WRITE' });
    await expect(
      service.addExample('u1', 'p1', { text: 'It is Friday.' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('the first sentence starts the schedule for tomorrow', async () => {
    const { service, prisma } = setup({ stage: 'WRITE' });
    await service.addExample('u1', 'p1', { text: 'We met the deadline.' });
    expect(prisma.phrase.update.mock.calls[0][0].data).toEqual({
      stage: 'RECALL',
      intervalDays: 1,
      nextReviewAt: new Date('2026-11-06T00:00:00.000Z'),
    });
    expect(prisma.phraseActivityDay.upsert).toHaveBeenCalled();
  });
});

describe('review (step 3)', () => {
  const base = {
    answer: 'meet a deadline',
    usedHint: false,
    grade: 'EASY' as const,
    sentence: 'Our team meets deadlines every week.',
  };

  it('cannot review a phrase that has no sentence yet', async () => {
    const { service } = setup({ stage: 'WRITE' });
    await expect(service.review('u1', 'p1', base)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('records every accepted recall (also "forgot") for the learning calendar, and none that is refused', async () => {
    const { service, prisma } = setup();
    await service.review('u1', 'p1', {
      answer: 'wrong',
      usedHint: true,
      grade: 'FORGOT',
    });
    expect(prisma.phraseReview.create).toHaveBeenCalledWith({
      data: { phraseId: 'p1', grade: 'FORGOT', usedHint: true },
    });

    prisma.phraseReview.create.mockClear();
    await expect(
      service.review('u1', 'p1', { ...base, answer: 'wrong' }),
    ).rejects.toThrow();
    expect(prisma.phraseReview.create).not.toHaveBeenCalled();
  });

  it('a wrong answer cannot be graded Easy', async () => {
    const { service } = setup();
    await expect(
      service.review('u1', 'p1', { ...base, answer: 'meet a dead line' }),
    ).rejects.toThrow('Quên');
  });

  it('a hint rules out Easy', async () => {
    const { service } = setup();
    await expect(
      service.review('u1', 'p1', { ...base, usedHint: true }),
    ).rejects.toThrow('gợi ý');
  });

  it('needs a new sentence for Hard and Easy', async () => {
    const { service } = setup();
    await expect(
      service.review('u1', 'p1', { ...base, sentence: undefined }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a sentence already written, ignoring case and punctuation', async () => {
    const { service } = setup({}, ['We met the deadline!']);
    await expect(
      service.review('u1', 'p1', { ...base, sentence: 'we MET the deadline' }),
    ).rejects.toThrow('trùng');
  });

  it('rejects a repeat of the sample sentence', async () => {
    const { service } = setup();
    await expect(
      service.review('u1', 'p1', {
        ...base,
        sentence: 'We must meet the deadline.',
      }),
    ).rejects.toThrow('trùng');
  });

  it('saves the sentence and the new schedule', async () => {
    const { service, prisma } = setup();
    const result = await service.review('u1', 'p1', base);
    expect(result.isAnswerCorrect).toBe(true);
    expect(prisma.phrase.update.mock.calls[0][0].data).toMatchObject({
      stage: 'SPEAK',
      intervalDays: 3,
      easyStreak: 1,
      nextReviewAt: new Date('2026-11-08T00:00:00.000Z'),
    });
    expect(prisma.phraseExample.create.mock.calls[0][0].data).toMatchObject({
      step: 'RECALL',
      text: base.sentence,
    });
  });

  it('forgetting needs no sentence and saves none', async () => {
    const { service, prisma } = setup();
    await service.review('u1', 'p1', {
      answer: '',
      usedHint: true,
      grade: 'FORGOT',
    });
    expect(prisma.phraseExample.create).not.toHaveBeenCalled();
    expect(prisma.phrase.update.mock.calls[0][0].data).toMatchObject({
      stage: 'RECALL',
      intervalDays: 1,
    });
  });
});

describe('recordSpoken (step 4)', () => {
  it('works out for itself whether the phrase was said', async () => {
    const { service, prisma } = setup({ stage: 'SPEAK' });
    const result = await service.recordSpoken('u1', 'p1', {
      transcript: 'we met the deadline last week',
    });
    expect(result.containsPhrase).toBe(true);
    expect(
      prisma.phraseSpokenAttempt.create.mock.calls[0][0].data,
    ).toMatchObject({
      containsPhrase: true,
    });
    expect(prisma.phrase.update.mock.calls[0][0].data).toEqual({
      speakPassed: true,
      stage: 'RECALL',
    });
  });

  it('a miss is recorded but changes nothing', async () => {
    const { service, prisma } = setup({ stage: 'SPEAK' });
    const result = await service.recordSpoken('u1', 'p1', {
      transcript: 'I like coffee',
    });
    expect(result.containsPhrase).toBe(false);
    expect(prisma.phrase.update.mock.calls[0][0].data).toEqual({});
  });
});
