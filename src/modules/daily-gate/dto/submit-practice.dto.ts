import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsInt,
  ValidateNested,
} from 'class-validator';

export class PracticeAnswerDto {
  @IsInt()
  questionId: number;

  /** A number (the chosen option) or, for matching, one index per word. */
  @IsDefined()
  answer: number | number[];
}

export class SubmitPracticeDto {
  @IsInt()
  lessonId: number;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PracticeAnswerDto)
  answers: PracticeAnswerDto[];
}
