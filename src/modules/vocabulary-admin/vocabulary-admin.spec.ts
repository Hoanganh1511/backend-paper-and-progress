import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  categoryState,
  contentFields,
  MAX_ITEMS_PER_CATEGORY,
} from './vocabulary-content.schema.js';
import {
  createVocabularySchema,
  listVocabularyQuerySchema,
  updateVocabularySchema,
} from './vocabulary-admin.schema.js';
import { VocabularyAdminService } from './vocabulary-admin.service.js';

const valid = {
  unitId: 2,
  section: 'TOPIC_CONTRAST' as const,
  word: 'artificial',
  partsOfSpeech: ['adjective' as const],
  level: 'B2' as const,
  meaning: 'made by people, not natural',
  meaningVi: 'nhân tạo',
};

describe('word fields', () => {
  it('needs a word, a part of speech, a level and both meanings', () => {
    expect(createVocabularySchema.safeParse(valid).success).toBe(true);
    for (const missing of [
      'word',
      'partsOfSpeech',
      'level',
      'meaning',
      'meaningVi',
    ] as const) {
      const { [missing]: _removed, ...rest } = valid;
      expect(createVocabularySchema.safeParse(rest).success).toBe(false);
    }
    expect(
      createVocabularySchema.safeParse({ ...valid, partsOfSpeech: [] }).success,
    ).toBe(false);
  });

  it('allows several parts of speech, and only the known ones and levels', () => {
    expect(
      createVocabularySchema.safeParse({
        ...valid,
        partsOfSpeech: ['noun', 'verb'],
      }).success,
    ).toBe(true);
    expect(
      createVocabularySchema.safeParse({ ...valid, partsOfSpeech: ['thing'] })
        .success,
    ).toBe(false);
    expect(
      createVocabularySchema.safeParse({ ...valid, level: 'D1' }).success,
    ).toBe(false);
  });

  it('starts every category empty, and has no minimum number of items', () => {
    const parsed = createVocabularySchema.parse(valid);
    for (const category of Object.keys(contentFields)) {
      expect(parsed[category as keyof typeof parsed]).toEqual([]);
    }
  });

  it('leaves out what an update does not send, so saving one field cannot empty the rest', () => {
    const parsed = updateVocabularySchema.parse({ meaningVi: 'giả tạo' });
    expect(parsed).toEqual({ meaningVi: 'giả tạo' });
    // none of the ten categories, nor the other texts, come back as empty values
    expect(Object.keys(parsed)).toEqual(['meaningVi']);
  });

  it('still checks what an update does send', () => {
    expect(
      updateVocabularySchema.safeParse({ partsOfSpeech: [] }).success,
    ).toBe(false);
    expect(updateVocabularySchema.safeParse({ word: '' }).success).toBe(false);
    expect(
      updateVocabularySchema.safeParse({
        wordFamily: [{ id: 'a', word: 'artificially' }],
      }).success,
    ).toBe(true);
    // an item without an id is refused in an update too
    expect(
      updateVocabularySchema.safeParse({ synonyms: [{ word: 'fake' }] })
        .success,
    ).toBe(false);
  });
});

describe('category items', () => {
  const family = (id: string) => ({
    id,
    word: 'artificially',
    partOfSpeech: 'adverb',
  });

  it('keeps items in the order they were sent, with whatever fields are filled', () => {
    const parsed = createVocabularySchema.parse({
      ...valid,
      wordFamily: [family('a'), { id: 'b', word: 'artificiality' }],
    });
    expect(parsed.wordFamily.map((item) => item.id)).toEqual(['a', 'b']);
    // a half-filled item is accepted: it just counts as "in progress"
    expect(parsed.wordFamily[1]).toMatchObject({
      word: 'artificiality',
      partOfSpeech: '',
      example: '',
    });
  });

  it('refuses an item without an id, an unknown choice, and too many items', () => {
    const bad = (value: unknown) =>
      createVocabularySchema.safeParse({ ...valid, ...(value as object) })
        .success;
    expect(bad({ wordFamily: [{ word: 'x' }] })).toBe(false);
    expect(bad({ collocations: [{ id: 'a', patternType: 'WHATEVER' }] })).toBe(
      false,
    );
    expect(
      bad({
        synonyms: Array.from(
          { length: MAX_ITEMS_PER_CATEGORY + 1 },
          (_, i) => ({
            id: String(i),
          }),
        ),
      }),
    ).toBe(false);
  });

  it('tells a phrasal verb of the word from a related expression', () => {
    const ok = createVocabularySchema.safeParse({
      ...valid,
      phrasalVerbs: [
        { id: 'a', phrasalVerb: 'carry out', origin: 'DERIVED' },
        { id: 'b', phrasalVerb: 'look up to', origin: 'RELATED' },
        { id: 'c', phrasalVerb: 'turn off' },
      ],
    });
    expect(ok.success).toBe(true);
    expect(
      createVocabularySchema.safeParse({
        ...valid,
        phrasalVerbs: [{ id: 'a', origin: 'MAYBE' }],
      }).success,
    ).toBe(false);
  });
});

describe('categoryState', () => {
  it('is empty without items, in progress with a half-filled one, completed when all are filled', () => {
    expect(categoryState('synonyms', [])).toBe('EMPTY');
    expect(categoryState('synonyms', [{ id: 'a', word: '' }])).toBe(
      'IN_PROGRESS',
    );
    expect(
      categoryState('synonyms', [
        { id: 'a', word: 'fake' },
        { id: 'b', word: '' },
      ]),
    ).toBe('IN_PROGRESS');
    expect(categoryState('synonyms', [{ id: 'a', word: 'fake' }])).toBe(
      'COMPLETED',
    );
  });

  it('judges each category by its own required fields', () => {
    expect(
      categoryState('conversations', [
        { id: 'a', situation: 'Stand-up', speakerA: 'Hi', speakerB: '' },
      ]),
    ).toBe('IN_PROGRESS');
    expect(
      categoryState('dependentPrepositions', [
        { id: 'a', expression: 'depend', preposition: 'on' },
      ]),
    ).toBe('COMPLETED');
  });
});

describe('list query', () => {
  it('reads numbers from the address, with defaults', () => {
    expect(listVocabularyQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(
      listVocabularyQuerySchema.parse({ unitId: '3', page: '2', level: 'A1' }),
    ).toMatchObject({ unitId: 3, page: 2, level: 'A1' });
    expect(listVocabularyQuerySchema.safeParse({ limit: '500' }).success).toBe(
      false,
    );
  });
});

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  unitId: 2,
  section: 'TOPIC_CONTRAST',
  word: 'artificial',
  meaning: 'made by people',
  example: null,
  contrast: null,
  forms: null,
  pattern: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  pronunciation: null,
  partsOfSpeech: [],
  level: null,
  topics: [],
  meaningVi: null,
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
  unit: { id: 2, unitNumber: 2, topic: 'Travel' },
  ...over,
});

function setup(options: { existing?: object | null; taken?: boolean } = {}) {
  const existing = options.existing === undefined ? row() : options.existing;
  const prisma = {
    vocabularyUnit: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: 2, unitNumber: 2, topic: 'T' }]),
      findUnique: vi.fn().mockResolvedValue({ id: 2 }),
    },
    vocabularyWord: {
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([row()]),
      findUnique: vi.fn().mockResolvedValue(existing),
      findFirst: vi.fn().mockResolvedValue(options.taken ? { id: 9 } : null),
      create: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { service: new VocabularyAdminService(prisma as never), prisma };
}

describe('VocabularyAdminService', () => {
  it('lists words with how far each category is, never a percentage', async () => {
    const { service, prisma } = setup();
    prisma.vocabularyWord.findMany.mockResolvedValue([
      row({
        synonyms: [{ id: 'a', word: 'fake' }],
        wordFamily: [{ id: 'b', word: '' }],
      }),
    ]);
    const result = await service.list({ page: 2, limit: 10, q: 'art' });
    expect(prisma.vocabularyWord.findMany.mock.calls[0][0]).toMatchObject({
      skip: 10,
      take: 10,
    });
    expect(result.total).toBe(1);
    expect(result.items[0].categories.synonyms).toEqual({
      count: 1,
      state: 'COMPLETED',
    });
    expect(result.items[0].categories.wordFamily.state).toBe('IN_PROGRESS');
    expect(result.items[0].categories.antonyms.state).toBe('EMPTY');
  });

  it('reads a word seeded before the new fields as empty ones', async () => {
    const { service } = setup();
    const word = await service.get(1);
    expect(word).toMatchObject({
      pronunciation: '',
      meaningVi: '',
      level: null,
      partsOfSpeech: [],
      synonyms: [],
    });
  });

  it('creates a word in a unit that exists, once per unit', async () => {
    const { service, prisma } = setup();
    await service.create(createVocabularySchema.parse(valid));
    expect(prisma.vocabularyWord.create.mock.calls[0][0].data).toMatchObject({
      word: 'artificial',
      level: 'B2',
      pronunciation: null,
      collocations: [],
    });

    const taken = setup({ taken: true });
    await expect(
      taken.service.create(createVocabularySchema.parse(valid)),
    ).rejects.toThrow(ConflictException);

    const noUnit = setup();
    noUnit.prisma.vocabularyUnit.findUnique.mockResolvedValue(null);
    await expect(
      noUnit.service.create(createVocabularySchema.parse(valid)),
    ).rejects.toThrow(BadRequestException);
  });

  it('changes only what was sent, and clears an optional text with an empty string', async () => {
    const { service, prisma } = setup();
    await service.update(1, { meaningVi: 'giả tạo', pronunciation: '' });
    expect(prisma.vocabularyWord.update.mock.calls[0][0].data).toEqual({
      meaningVi: 'giả tạo',
      pronunciation: null,
    });
  });

  it('refuses to rename a word to one the unit already has', async () => {
    const { service } = setup({ taken: true });
    await expect(service.update(1, { word: 'natural' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('404s for a word that is not there', async () => {
    const { service } = setup({ existing: null });
    await expect(service.get(5)).rejects.toThrow(NotFoundException);
    await expect(service.update(5, { word: 'x' })).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.remove(5)).rejects.toThrow(NotFoundException);
  });

  it('offers the units and sections to pick from', async () => {
    const { service } = setup();
    const meta = await service.meta();
    expect(meta.units).toHaveLength(1);
    expect(meta.sections).toContain('PHRASAL_VERB');
  });
});
