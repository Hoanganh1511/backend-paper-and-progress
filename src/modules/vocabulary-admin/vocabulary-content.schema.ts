import { z } from 'zod';

/*
 * The ten learning categories of a word. Each is an ordered list of items the
 * author adds, edits, duplicates and reorders in the form, and the whole list is
 * saved with the word. Items may be incomplete (the form marks a category
 * "in progress"): only the word-level fields are required, and there is no
 * minimum number of items.
 */

export const PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'preposition',
  'conjunction',
  'pronoun',
  'determiner',
  'interjection',
] as const;

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export const PATTERN_TYPES = [
  'VERB_NOUN',
  'ADJECTIVE_NOUN',
  'ADVERB_ADJECTIVE',
  'NOUN_PREPOSITION',
  'NOUN_NOUN',
  'VERB_PREPOSITION',
  'VERB_ADVERB',
  'OTHER',
] as const;

export const CONTEXTS = [
  'GENERAL',
  'BUSINESS',
  'SOFTWARE_ENGINEERING',
  'TOEIC',
] as const;

export const SEPARABILITY = ['SEPARABLE', 'INSEPARABLE'] as const;
export const TRANSITIVITY = ['TRANSITIVE', 'INTRANSITIVE'] as const;
/** A phrasal verb formed from this word, or only a related expression. */
export const PHRASAL_ORIGINS = ['DERIVED', 'RELATED'] as const;

export const CONTENT_CATEGORIES = [
  'wordFamily',
  'collocations',
  'phrasalVerbs',
  'wordPatterns',
  'wordFormation',
  'dependentPrepositions',
  'synonyms',
  'antonyms',
  'relatedVocabulary',
  'conversations',
] as const;
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

export const MAX_ITEMS_PER_CATEGORY = 100;

const text = (max = 500) => z.string().trim().max(max).default('');
/** An enum field that may also be left empty. */
const choice = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal('')]).default('');
/** The id the form gives an item, so it can be found again when reordered. */
const itemId = z.string().trim().min(1).max(64);

const list = <T extends z.ZodTypeAny>(item: T) =>
  z.array(item).max(MAX_ITEMS_PER_CATEGORY).default([]);

export const wordFamilyItem = z.object({
  id: itemId,
  word: text(120),
  partOfSpeech: choice(PARTS_OF_SPEECH),
  meaningVi: text(),
  example: text(),
});

export const collocationItem = z.object({
  id: itemId,
  phrase: text(200),
  patternType: choice(PATTERN_TYPES),
  meaningVi: text(),
  example: text(),
  context: choice(CONTEXTS),
});

export const phrasalVerbItem = z.object({
  id: itemId,
  phrasalVerb: text(120),
  meaning: text(),
  separability: choice(SEPARABILITY),
  transitivity: choice(TRANSITIVITY),
  example: text(),
  relatedContext: text(),
  origin: choice(PHRASAL_ORIGINS),
});

export const wordPatternItem = z.object({
  id: itemId,
  pattern: text(200),
  explanation: text(),
  example: text(),
  translationVi: text(),
});

export const wordFormationItem = z.object({
  id: itemId,
  rootWord: text(120),
  prefix: text(40),
  suffix: text(40),
  derivedWord: text(120),
  partOfSpeech: choice(PARTS_OF_SPEECH),
  meaning: text(),
  rule: text(),
});

export const dependentPrepositionItem = z.object({
  id: itemId,
  expression: text(200),
  preposition: text(40),
  pattern: text(200),
  meaning: text(),
  example: text(),
});

/** Synonyms and antonyms share their fields. */
export const contrastItem = z.object({
  id: itemId,
  word: text(120),
  partOfSpeech: choice(PARTS_OF_SPEECH),
  meaning: text(),
  usageDifference: text(),
  example: text(),
});

export const relatedVocabularyItem = z.object({
  id: itemId,
  word: text(120),
  partOfSpeech: choice(PARTS_OF_SPEECH),
  meaning: text(),
  relationship: text(200),
  example: text(),
});

export const conversationItem = z.object({
  id: itemId,
  situation: text(200),
  speakerARole: text(100),
  speakerA: text(),
  speakerBRole: text(100),
  speakerB: text(),
  translationVi: text(1000),
  /** The words of the target vocabulary to highlight in the lines. */
  highlight: text(200),
});

export const contentFields = {
  wordFamily: list(wordFamilyItem),
  collocations: list(collocationItem),
  phrasalVerbs: list(phrasalVerbItem),
  wordPatterns: list(wordPatternItem),
  wordFormation: list(wordFormationItem),
  dependentPrepositions: list(dependentPrepositionItem),
  synonyms: list(contrastItem),
  antonyms: list(contrastItem),
  relatedVocabulary: list(relatedVocabularyItem),
  conversations: list(conversationItem),
};

export type WordContent = {
  [K in ContentCategory]: z.infer<(typeof contentFields)[K]>;
};

/** The fields that decide whether an item is finished: the rest are help. */
export const REQUIRED_ITEM_FIELDS: Record<ContentCategory, readonly string[]> =
  {
    wordFamily: ['word', 'partOfSpeech'],
    collocations: ['phrase'],
    phrasalVerbs: ['phrasalVerb', 'meaning'],
    wordPatterns: ['pattern'],
    wordFormation: ['rootWord', 'derivedWord'],
    dependentPrepositions: ['expression', 'preposition'],
    synonyms: ['word'],
    antonyms: ['word'],
    relatedVocabulary: ['word'],
    conversations: ['situation', 'speakerA', 'speakerB'],
  };

export type CategoryState = 'EMPTY' | 'IN_PROGRESS' | 'COMPLETED';

/**
 * Empty: no items. Completed: at least one item and every item has its
 * required fields. In progress: anything in between. Never a percentage.
 */
export function categoryState(
  category: ContentCategory,
  items: readonly Record<string, unknown>[],
): CategoryState {
  if (items.length === 0) return 'EMPTY';
  const required = REQUIRED_ITEM_FIELDS[category];
  const isDone = (item: Record<string, unknown>) =>
    required.every((field) => {
      const value = item[field];
      return typeof value === 'string' && value.trim() !== '';
    });
  return items.every(isDone) ? 'COMPLETED' : 'IN_PROGRESS';
}
