import { z } from 'zod';
import {
  CEFR_LEVELS,
  PARTS_OF_SPEECH,
  contentFields,
} from './vocabulary-content.schema.js';

export const VOCAB_SECTIONS = [
  'TOPIC_CONTRAST',
  'PHRASAL_VERB',
  'PHRASE_COLLOCATION',
  'WORD_PATTERN',
  'WORD_FORMATION',
] as const;

const required = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).default('');

/** The fields of the word itself; the learning categories come after. */
const wordFields = {
  unitId: z.number().int().positive(),
  section: z.enum(VOCAB_SECTIONS),
  word: required(120),
  pronunciation: optional(100),
  // One word can be a noun and a verb at once.
  partsOfSpeech: z
    .array(z.enum(PARTS_OF_SPEECH))
    .min(1, 'Chọn ít nhất một từ loại.')
    .max(PARTS_OF_SPEECH.length),
  level: z.enum(CEFR_LEVELS),
  topics: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  /** The short definition, in English. */
  meaning: required(500),
  meaningVi: required(500),
  // What the flashcard of the Daily English lesson shows.
  example: optional(500),
  contrast: optional(300),
  forms: optional(300),
  pattern: optional(300),
};

export const createVocabularySchema = z.object({
  ...wordFields,
  ...contentFields,
});
/**
 * An update changes only what it sends. `.partial()` would not do: it keeps the
 * defaults ("" and []), so saving one field would blank every other one and
 * empty all ten categories. Here each field loses its default and becomes optional.
 */
const withoutDefault = (field: z.ZodType): z.ZodType =>
  field instanceof z.ZodDefault ? (field.unwrap() as z.ZodType) : field;

export const updateVocabularySchema = z.object(
  Object.fromEntries(
    Object.entries(createVocabularySchema.shape).map(([key, field]) => [
      key,
      withoutDefault(field).optional(),
    ]),
  ),
) as unknown as z.ZodType<Partial<z.infer<typeof createVocabularySchema>>>;

export const listVocabularyQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  unitId: z.coerce.number().int().positive().optional(),
  level: z.enum(CEFR_LEVELS).optional(),
  section: z.enum(VOCAB_SECTIONS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateVocabularyDto = z.infer<typeof createVocabularySchema>;
export type UpdateVocabularyDto = z.infer<typeof updateVocabularySchema>;
export type ListVocabularyQuery = z.infer<typeof listVocabularyQuerySchema>;
