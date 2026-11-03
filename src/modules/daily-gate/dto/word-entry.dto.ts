import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SENTENCE_MAX } from './phrase.dto.js';

/** Sentences are required; every other kind is a help the learner may fill in. */
export const ENTRY_KINDS = [
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
] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/** A sentence, a collocation, a related word... the learner writes for a word. */
export class AddWordEntryDto {
  @IsInt()
  lessonId: number;

  @IsInt()
  wordId: number;

  /** Defaults to a sentence. */
  @IsOptional()
  @IsIn(ENTRY_KINDS)
  kind?: EntryKind;

  @IsString()
  @IsNotEmpty()
  @MaxLength(SENTENCE_MAX)
  text: string;
}

/** "Đã biết" or "Cần ôn lại" for a word; `null` takes the mark off. */
export class SetWordMarkDto {
  @IsInt()
  lessonId: number;

  @IsInt()
  wordId: number;

  @IsOptional()
  @IsIn(['known', 'review'])
  mark?: 'known' | 'review' | null;
}
