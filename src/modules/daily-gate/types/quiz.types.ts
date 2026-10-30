export type PracticeQuestionType =
  'MATCHING' | 'FILL_BLANK' | 'CHOOSE_CONTRAST';

export interface MatchingQuestion {
  id: number;
  type: 'MATCHING';
  instruction: string;
  /** Words or phrases, in a fixed order. */
  left: string[];
  /** The meanings, shuffled: `answer[i]` is the index in `right` that fits `left[i]`. */
  right: string[];
  answer: number[];
  /** `wordIds[i]` is the vocabulary word behind `left[i]`. */
  wordIds: number[];
}

export interface ChoiceQuestion {
  id: number;
  type: 'FILL_BLANK' | 'CHOOSE_CONTRAST';
  instruction: string;
  sentence: string;
  options: string[];
  correctIndex: number;
  /** Shown after answering: what the word means and how it differs. */
  explanation: string;
  wordId: number;
}

export type PracticeQuestion = MatchingQuestion | ChoiceQuestion;

/** A gate-test question as it is kept on the server. */
export interface TestQuestion {
  id: number;
  type: 'MULTIPLE_CHOICE';
  question: string;
  options: string[];
  correctIndex: number;
  wordId: number;
  explanation: string;
}

/** What the client gets: never the answer. */
export type PublicTestQuestion = Pick<
  TestQuestion,
  'id' | 'type' | 'question' | 'options'
>;

export type PracticeAnswer = number | number[];

export interface SubmittedAnswer<T> {
  questionId: number;
  answer: T;
}

export interface WordResult {
  wordId: number;
  correct: boolean;
}
