import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const PHRASE_MAX = 120;
export const MEANING_MAX = 300;
export const SENTENCE_MAX = 300;
export const TRANSCRIPT_MAX = 500;

export class CreatePhraseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PHRASE_MAX)
  phrase: string;

  /** What the phrase means to the user, in their own words (any language). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(MEANING_MAX)
  meaning: string;

  @IsOptional()
  @IsString()
  @MaxLength(SENTENCE_MAX)
  sampleSentence?: string;

  /** The lesson word this phrase was saved from. */
  @IsOptional()
  @IsInt()
  wordId?: number;
}

export class UpdatePhraseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(PHRASE_MAX)
  phrase?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MEANING_MAX)
  meaning?: string;

  @IsOptional()
  @IsString()
  @MaxLength(SENTENCE_MAX)
  sampleSentence?: string;
}

export class AddExampleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(SENTENCE_MAX)
  text: string;
}

export class ReviewPhraseDto {
  /** The phrase as the user typed it from memory. */
  @IsString()
  @MaxLength(PHRASE_MAX)
  answer: string;

  @IsBoolean()
  usedHint: boolean;

  @IsIn(['FORGOT', 'HARD', 'EASY'])
  grade: 'FORGOT' | 'HARD' | 'EASY';

  /** A new sentence using the phrase; required for HARD and EASY. */
  @IsOptional()
  @IsString()
  @MaxLength(SENTENCE_MAX)
  sentence?: string;
}

export class SpokenAttemptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(TRANSCRIPT_MAX)
  transcript: string;
}

export class ListPhrasesQuery {
  @IsOptional()
  @IsIn(['true', 'false'])
  due?: 'true' | 'false';

  @IsOptional()
  @IsIn(['WRITE', 'RECALL', 'SPEAK', 'MASTERED'])
  stage?: 'WRITE' | 'RECALL' | 'SPEAK' | 'MASTERED';
}
