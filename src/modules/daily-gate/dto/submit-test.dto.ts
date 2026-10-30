import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class TestAnswerDto {
  @IsInt()
  questionId: number;

  @IsInt()
  @Min(0)
  @Max(9)
  selectedIndex: number;
}

export class SubmitTestDto {
  @IsInt()
  lessonId: number;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TestAnswerDto)
  answers: TestAnswerDto[];
}
