import { IsInt } from 'class-validator';

export class SubmitLearnDto {
  @IsInt()
  lessonId: number;
}
