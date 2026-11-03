import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  DailyLesson,
  UserDailyProgress,
  VocabularyWord,
} from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import type { SubmitLearnDto } from '../dto/submit-learn.dto.js';
import type { SubmitPracticeDto } from '../dto/submit-practice.dto.js';
import type { SubmitTestDto } from '../dto/submit-test.dto.js';
import type { PracticeAnswer, WordResult } from '../types/quiz.types.js';
import type {
  AddWordEntryDto,
  EntryKind,
  SetWordMarkDto,
} from '../dto/word-entry.dto.js';
import { containsPhrase } from './phrase-matcher.js';
import { QuizGeneratorService, hashSeed } from './quiz-generator.service.js';
import { VocabularyService } from './vocabulary.service.js';

export const PASS_SCORE = 70;
/** Sentences the learner must write for each word before the word counts as learned. */
export const SENTENCES_PER_WORD = 5;
/** How many of each kind a word keeps; only sentences are required. */
export const MAX_ENTRIES: Record<EntryKind, number> = {
  SENTENCE: SENTENCES_PER_WORD,
  COLLOCATION: 20,
  RELATED: 20,
  WORD_FAMILY: 20,
  PHRASAL_VERB: 20,
  WORD_PATTERN: 20,
  WORD_FORMATION: 20,
  DEPENDENT_PREPOSITION: 20,
  SYNONYM: 20,
  ANTONYM: 20,
  CONVERSATION: 20,
};
/** Kinds whose text has to use the word itself; the others are about other words. */
const MUST_USE_WORD = new Set<EntryKind>(['SENTENCE', 'COLLOCATION']);
const ENTRY_LABELS: Record<EntryKind, string> = {
  SENTENCE: 'câu',
  COLLOCATION: 'cụm từ',
  RELATED: 'từ liên quan',
  WORD_FAMILY: 'dạng từ',
  PHRASAL_VERB: 'phrasal verb',
  WORD_PATTERN: 'cấu trúc',
  WORD_FORMATION: 'cách tạo từ',
  DEPENDENT_PREPOSITION: 'giới từ đi kèm',
  SYNONYM: 'từ đồng nghĩa',
  ANTONYM: 'từ trái nghĩa',
  CONVERSATION: 'hội thoại',
};
/** A lesson with fewer words than this is "not ready": its words are still to be written. */
export const MIN_READY_WORDS = 15;
const TEST_QUESTIONS = 10;
const FINAL_TEST_QUESTIONS = 30;
const TEST_SECONDS = 300;
const FINAL_TEST_SECONDS = 900;
const CACHE_MS = 60_000;

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

/** The ten learning categories an admin writes for a word (see the vocabulary admin). */
const CONTENT_KEYS = [
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

/**
 * A word as the lesson shows it: the card's fields, what kind of word it is, and
 * the learning categories that have something in them (an empty one is left out,
 * so a word seeded without them costs nothing).
 */
export function toLearnWord(word: VocabularyWord) {
  const content: Record<string, unknown[]> = {};
  for (const key of CONTENT_KEYS) {
    const items: unknown = word[key];
    if (Array.isArray(items) && items.length > 0) content[key] = items;
  }
  return {
    id: word.id,
    word: word.word,
    meaning: word.meaning,
    example: word.example,
    contrast: word.contrast,
    forms: word.forms,
    pattern: word.pattern,
    pronunciation: word.pronunciation,
    partsOfSpeech: word.partsOfSpeech,
    level: word.level,
    topics: word.topics,
    meaningVi: word.meaningVi,
    content,
  };
}

interface LessonContext {
  lesson: DailyLesson;
  wordCount: number;
}

@Injectable()
export class DailyGateService {
  private cached?: { key: string; at: number; value: LessonContext | null };

  constructor(
    private prisma: PrismaService,
    private vocabulary: VocabularyService,
    private quiz: QuizGeneratorService,
    private config: ConfigService,
  ) {}

  /* ------------------------------------------------------------------------ */
  /* Which day it is                                                          */
  /* ------------------------------------------------------------------------ */

  /** Today as a UTC midnight, which a `@db.Date` column compares as that calendar day. */
  today(): Date {
    const override = this.config.get<string>('DAILY_GATE_TODAY');
    if (override) return new Date(`${override}T00:00:00.000Z`);
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  /** Today's lesson and how many words it has; null on a day without a lesson. */
  private async currentLesson(): Promise<LessonContext | null> {
    const date = this.today();
    const key = dateKey(date);
    if (
      this.cached &&
      this.cached.key === key &&
      Date.now() - this.cached.at < CACHE_MS
    ) {
      return this.cached.value;
    }
    const lesson = await this.prisma.dailyLesson.findUnique({
      where: { date },
    });
    const value = lesson
      ? { lesson, wordCount: await this.vocabulary.countWords(lesson.unitIds) }
      : null;
    this.cached = { key, at: Date.now(), value };
    return value;
  }

  /* ------------------------------------------------------------------------ */
  /* GET /today                                                               */
  /* ------------------------------------------------------------------------ */

  async getToday(userId: string) {
    const context = await this.currentLesson();
    if (!context) return this.noLessonToday();

    const { lesson, wordCount } = context;
    const [units, progress, learnedWords] = await Promise.all([
      this.vocabulary.unitsByIds(lesson.unitIds),
      this.ensureProgress(userId, lesson.id),
      this.learnedWordCount(userId, lesson.id),
    ]);
    return {
      active: true as const,
      lessonId: lesson.id,
      dayNumber: lesson.dayNumber,
      date: dateKey(lesson.date),
      type: lesson.type,
      units,
      totalWords: wordCount,
      // words with all their sentences written
      learnedWords,
      // false while the words of these units are still to be written
      isReady: wordCount >= MIN_READY_WORDS,
      progress: this.publicProgress(progress),
    };
  }

  /**
   * The ids of today's words the learner has learned: marked "known", or with
   * all the sentences written. Flipping through the cards counts for nothing.
   */
  private async learnedWordIds(userId: string, lessonId: number) {
    const [counts, known] = await Promise.all([
      this.prisma.wordEntry.groupBy({
        by: ['wordId'],
        where: { userId, lessonId, kind: 'SENTENCE' },
        _count: { _all: true },
      }),
      this.prisma.wordMark.findMany({
        where: { userId, lessonId, mark: 'KNOWN' },
        select: { wordId: true },
      }),
    ]);
    const learned = new Set(known.map((row) => row.wordId));
    for (const count of counts) {
      if (count._count._all >= SENTENCES_PER_WORD) learned.add(count.wordId);
    }
    return learned;
  }

  private async learnedWordCount(userId: string, lessonId: number) {
    return (await this.learnedWordIds(userId, lessonId)).size;
  }

  private async noLessonToday() {
    const today = this.today();
    const [first, last] = await Promise.all([
      this.prisma.dailyLesson.findFirst({ orderBy: { dayNumber: 'asc' } }),
      this.prisma.dailyLesson.findFirst({ orderBy: { dayNumber: 'desc' } }),
    ]);
    if (first && today < first.date) {
      return {
        active: false as const,
        reason: 'NOT_STARTED' as const,
        startDate: dateKey(first.date),
      };
    }
    return {
      active: false as const,
      reason:
        last && today > last.date ? ('FINISHED' as const) : ('NONE' as const),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Learn                                                                    */
  /* ------------------------------------------------------------------------ */

  async getLearn(userId: string) {
    const { lesson } = await this.requireReadyLesson();
    await this.ensureProgress(userId, lesson.id);
    const [units, words] = await Promise.all([
      this.vocabulary.unitsByIds(lesson.unitIds),
      this.vocabulary.wordsOfUnits(lesson.unitIds),
    ]);
    return {
      lessonId: lesson.id,
      unitTopic: units.map((unit) => unit.topic).join(' · '),
      sections: this.vocabulary.groupBySection(words).map((section) => ({
        type: section.type,
        words: section.words.map(toLearnWord),
      })),
      totalWords: words.length,
      sentencesPerWord: SENTENCES_PER_WORD,
      entries: await this.entriesByWord(userId, lesson.id),
      marks: await this.marksByWord(userId, lesson.id),
    };
  }

  /** What the user has written today, by word id; kept on the server so it survives a reload. */
  private async entriesByWord(userId: string, lessonId: number) {
    const rows = await this.prisma.wordEntry.findMany({
      where: { userId, lessonId },
      orderBy: { id: 'asc' },
    });
    const byWord: Record<
      number,
      { id: number; kind: EntryKind; text: string }[]
    > = {};
    for (const row of rows) {
      (byWord[row.wordId] ??= []).push({
        id: row.id,
        kind: row.kind,
        text: row.text,
      });
    }
    return byWord;
  }

  private async marksByWord(userId: string, lessonId: number) {
    const rows = await this.prisma.wordMark.findMany({
      where: { userId, lessonId },
    });
    const byWord: Record<number, 'known' | 'review'> = {};
    for (const row of rows) {
      byWord[row.wordId] = row.mark === 'KNOWN' ? 'known' : 'review';
    }
    return byWord;
  }

  async addEntry(userId: string, dto: AddWordEntryDto) {
    const { lesson } = await this.requireReadyLesson(dto.lessonId);
    const words = await this.vocabulary.wordsOfUnits(lesson.unitIds);
    const word = words.find((candidate) => candidate.id === dto.wordId);
    if (!word) throw new BadRequestException('Từ này không thuộc bài hôm nay.');

    const kind = dto.kind ?? 'SENTENCE';
    const text = dto.text.trim();
    // A sentence or a collocation must use the word; a related word is a different word.
    if (MUST_USE_WORD.has(kind) && !containsPhrase(word.word, text)) {
      throw new BadRequestException(
        `${kind === 'SENTENCE' ? 'Câu' : 'Cụm từ'} chưa có “${word.word}”.`,
      );
    }
    const existing = await this.prisma.wordEntry.findMany({
      where: { userId, lessonId: lesson.id, wordId: word.id },
      orderBy: { id: 'asc' },
    });
    const ofKind = existing.filter((row) => row.kind === kind);
    const key = (value: string) => value.toLowerCase().replace(/\s+/g, ' ');
    if (ofKind.some((row) => key(row.text) === key(text))) {
      throw new BadRequestException(
        `Bạn đã thêm ${ENTRY_LABELS[kind]} này rồi.`,
      );
    }
    if (ofKind.length >= MAX_ENTRIES[kind]) {
      throw new BadRequestException(
        `Từ này đã đủ ${MAX_ENTRIES[kind]} ${ENTRY_LABELS[kind]}.`,
      );
    }
    const created = await this.prisma.wordEntry.create({
      data: { userId, lessonId: lesson.id, wordId: word.id, kind, text },
    });
    return {
      entries: [...existing, created].map((row) => ({
        id: row.id,
        kind: row.kind,
        text: row.text,
      })),
    };
  }

  async removeEntry(userId: string, id: number) {
    const { lesson } = await this.requireReadyLesson();
    const row = await this.prisma.wordEntry.findFirst({
      where: { id, userId, lessonId: lesson.id },
    });
    if (!row) throw new NotFoundException('Không tìm thấy mục này.');
    await this.prisma.wordEntry.delete({ where: { id } });
    return { deleted: true as const };
  }

  async setMark(userId: string, dto: SetWordMarkDto) {
    const { lesson } = await this.requireReadyLesson(dto.lessonId);
    const words = await this.vocabulary.wordsOfUnits(lesson.unitIds);
    if (!words.some((word) => word.id === dto.wordId)) {
      throw new BadRequestException('Từ này không thuộc bài hôm nay.');
    }
    if (!dto.mark) {
      await this.prisma.wordMark.deleteMany({
        where: { userId, lessonId: lesson.id, wordId: dto.wordId },
      });
      return { mark: null };
    }
    const mark = dto.mark === 'known' ? 'KNOWN' : 'REVIEW';
    await this.prisma.wordMark.upsert({
      where: {
        userId_lessonId_wordId: {
          userId,
          lessonId: lesson.id,
          wordId: dto.wordId,
        },
      },
      create: { userId, lessonId: lesson.id, wordId: dto.wordId, mark },
      update: { mark },
    });
    return { mark: dto.mark };
  }

  async completeLearn(userId: string, { lessonId }: SubmitLearnDto) {
    const { lesson } = await this.requireReadyLesson(lessonId);
    const [words, learned] = await Promise.all([
      this.vocabulary.wordsOfUnits(lesson.unitIds),
      this.learnedWordIds(userId, lesson.id),
    ]);
    const missing = words.filter((word) => !learned.has(word.id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Còn ${missing.length} từ chưa học: đặt đủ ${SENTENCES_PER_WORD} câu hoặc đánh dấu “Đã biết”.`,
      );
    }
    const progress = await this.prisma.userDailyProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
      create: { userId, lessonId: lesson.id, learnCompleted: true },
      update: { learnCompleted: true },
    });
    return { progress: this.publicProgress(progress) };
  }

  /* ------------------------------------------------------------------------ */
  /* Practice                                                                 */
  /* ------------------------------------------------------------------------ */

  async getPractice(userId: string) {
    const { lesson } = await this.requireReadyLesson();
    const progress = await this.ensureProgress(userId, lesson.id);
    if (!progress.learnCompleted) {
      throw new BadRequestException('Hãy học từ vựng trước khi luyện tập.');
    }
    const words = await this.vocabulary.wordsOfUnits(lesson.unitIds);
    // One fixed set for the whole day, so the answers can be graded again later.
    const questions = this.quiz.generatePractice(
      words,
      hashSeed('practice', userId, lesson.id),
    );
    return { lessonId: lesson.id, questions };
  }

  async submitPractice(userId: string, dto: SubmitPracticeDto) {
    const { lesson } = await this.requireReadyLesson(dto.lessonId);
    const progress = await this.ensureProgress(userId, lesson.id);
    if (!progress.learnCompleted) {
      throw new BadRequestException('Hãy học từ vựng trước khi luyện tập.');
    }
    const words = await this.vocabulary.wordsOfUnits(lesson.unitIds);
    const questions = this.quiz.generatePractice(
      words,
      hashSeed('practice', userId, lesson.id),
    );
    const answers = dto.answers.map(({ questionId, answer }) => ({
      questionId,
      answer: this.toPracticeAnswer(answer),
    }));
    const graded = this.quiz.gradePractice(questions, answers);

    await this.saveReviews(userId, graded.reviews);
    await this.prisma.userDailyProgress.update({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
      data: { practiceCompleted: true },
    });
    return { score: graded.score, details: graded.details };
  }

  private toPracticeAnswer(answer: unknown): PracticeAnswer {
    if (typeof answer === 'number') return answer;
    if (Array.isArray(answer) && answer.every((n) => typeof n === 'number')) {
      return answer as number[];
    }
    throw new BadRequestException('Đáp án không hợp lệ.');
  }

  /* ------------------------------------------------------------------------ */
  /* Test (the gate)                                                          */
  /* ------------------------------------------------------------------------ */

  async getTest(userId: string) {
    const { lesson } = await this.requireReadyLesson();
    const progress = await this.ensureProgress(userId, lesson.id);
    if (!progress.practiceCompleted) {
      throw new BadRequestException(
        'Hãy hoàn thành phần luyện tập trước khi làm bài kiểm tra.',
      );
    }
    const questions = await this.buildTest(
      userId,
      lesson,
      progress.testAttempts,
    );
    return {
      lessonId: lesson.id,
      attempt: progress.testAttempts + 1,
      questions: this.quiz.toPublicTest(questions),
      timeLimit:
        lesson.type === 'FINAL_TEST' ? FINAL_TEST_SECONDS : TEST_SECONDS,
      passScore: PASS_SCORE,
    };
  }

  async submitTest(userId: string, dto: SubmitTestDto) {
    const { lesson } = await this.requireReadyLesson(dto.lessonId);
    const progress = await this.ensureProgress(userId, lesson.id);
    if (!progress.practiceCompleted) {
      throw new BadRequestException(
        'Hãy hoàn thành phần luyện tập trước khi làm bài kiểm tra.',
      );
    }
    const questions = await this.buildTest(
      userId,
      lesson,
      progress.testAttempts,
    );
    const graded = this.quiz.gradeTest(
      questions,
      dto.answers.map(({ questionId, selectedIndex }) => ({
        questionId,
        answer: selectedIndex,
      })),
    );
    const passed = graded.score >= PASS_SCORE;

    await this.saveReviews(userId, graded.reviews);
    const updated = await this.prisma.userDailyProgress.update({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
      data: {
        testCompleted: true,
        testScore: graded.score,
        bestScore: Math.max(graded.score, progress.bestScore ?? 0),
        // The next attempt gets a new set of questions.
        testAttempts: { increment: 1 },
        // Once passed, the day stays done, even if a later retry scores lower.
        ...(passed && !progress.gateUnlocked
          ? { gateUnlocked: true, completedAt: new Date() }
          : {}),
      },
    });
    return {
      score: graded.score,
      passed,
      gateUnlocked: updated.gateUnlocked,
      results: graded.results.map(({ wordId: _wordId, ...result }) => result),
    };
  }

  private async buildTest(
    userId: string,
    lesson: DailyLesson,
    attempt: number,
  ) {
    const words = await this.vocabulary.wordsOfUnits(lesson.unitIds);
    return this.quiz.generateTest(
      words,
      hashSeed('test', userId, lesson.id, attempt),
      lesson.type === 'FINAL_TEST' ? FINAL_TEST_QUESTIONS : TEST_QUESTIONS,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Stats and calendar                                                       */
  /* ------------------------------------------------------------------------ */

  async getStats(userId: string) {
    const today = this.today();
    const [lessons, progresses, weak] = await Promise.all([
      this.prisma.dailyLesson.findMany({ orderBy: { dayNumber: 'asc' } }),
      this.prisma.userDailyProgress.findMany({ where: { userId } }),
      this.prisma.wordReview.groupBy({
        by: ['wordId'],
        where: { userId, correct: false },
        _count: { _all: true },
        orderBy: { _count: { wordId: 'desc' } },
        take: 10,
      }),
    ]);
    const byLesson = new Map(progresses.map((p) => [p.lessonId, p]));
    const unlocked = (lessonId: number) =>
      byLesson.get(lessonId)?.gateUnlocked === true;

    const past = lessons.filter((lesson) => lesson.date <= today);
    let longest = 0;
    let run = 0;
    for (const lesson of past) {
      run = unlocked(lesson.id) ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    // The streak runs back from today, or from yesterday if today is not done yet.
    let current = 0;
    for (let i = past.length - 1; i >= 0; i -= 1) {
      if (unlocked(past[i].id)) current += 1;
      else if (
        i === past.length - 1 &&
        past[i].date.getTime() === today.getTime()
      )
        continue;
      else break;
    }

    const scores = progresses
      .filter((p) => p.gateUnlocked && p.bestScore !== null)
      .map((p) => p.bestScore as number);
    const learnedUnits = new Set(
      lessons
        .filter((lesson) => byLesson.get(lesson.id)?.learnCompleted)
        .flatMap((lesson) => lesson.unitIds),
    );
    const weakWords = await this.prisma.vocabularyWord.findMany({
      where: { id: { in: weak.map((w) => w.wordId) } },
      select: { id: true, word: true, meaning: true },
    });
    const wordsById = new Map(weakWords.map((w) => [w.id, w]));

    return {
      totalDays: lessons.length,
      completedDays: progresses.filter((p) => p.gateUnlocked).length,
      currentStreak: current,
      longestStreak: longest,
      averageScore: scores.length
        ? Math.round(
            scores.reduce((sum, score) => sum + score, 0) / scores.length,
          )
        : null,
      totalWordsLearned: learnedUnits.size
        ? await this.vocabulary.countWords([...learnedUnits])
        : 0,
      weakWords: weak.flatMap((entry) => {
        const word = wordsById.get(entry.wordId);
        return word
          ? [
              {
                wordId: word.id,
                word: word.word,
                meaning: word.meaning,
                wrongCount: entry._count._all,
              },
            ]
          : [];
      }),
    };
  }

  async getCalendar(userId: string) {
    const [lessons, progresses] = await Promise.all([
      this.prisma.dailyLesson.findMany({ orderBy: { dayNumber: 'asc' } }),
      this.prisma.userDailyProgress.findMany({ where: { userId } }),
    ]);
    const unitIds = [...new Set(lessons.flatMap((lesson) => lesson.unitIds))];
    const units = new Map(
      (await this.vocabulary.unitsByIds(unitIds)).map((unit) => [
        unit.id,
        unit,
      ]),
    );
    const byLesson = new Map(progresses.map((p) => [p.lessonId, p]));
    const today = this.today().getTime();

    return lessons.map((lesson) => {
      const topics = lesson.unitIds.flatMap((id) => units.get(id)?.topic ?? []);
      const progress = byLesson.get(lesson.id);
      return {
        dayNumber: lesson.dayNumber,
        date: dateKey(lesson.date),
        type: lesson.type,
        topic:
          lesson.type === 'FINAL_TEST'
            ? 'Final test'
            : lesson.type === 'NEW'
              ? (topics[0] ?? '')
              : topics.join(', '),
        completed: progress?.gateUnlocked === true,
        score: progress?.bestScore ?? null,
        isToday: lesson.date.getTime() === today,
        isPast: lesson.date.getTime() < today,
      };
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Shared                                                                   */
  /* ------------------------------------------------------------------------ */

  /** Today's lesson. With `lessonId`, that id must be today's lesson, so a stale page cannot write to another day. */
  private async requireReadyLesson(lessonId?: number): Promise<LessonContext> {
    const context = await this.currentLesson();
    if (!context) throw new NotFoundException('Hôm nay không có bài học.');
    if (lessonId !== undefined && lessonId !== context.lesson.id) {
      throw new BadRequestException('Bài học này không phải của hôm nay.');
    }
    if (context.wordCount < MIN_READY_WORDS) {
      throw new ConflictException('Từ vựng của bài học hôm nay chưa sẵn sàng.');
    }
    return context;
  }

  private ensureProgress(userId: string, lessonId: number) {
    return this.prisma.userDailyProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId },
      update: {},
    });
  }

  private publicProgress(progress: UserDailyProgress) {
    return {
      learnCompleted: progress.learnCompleted,
      practiceCompleted: progress.practiceCompleted,
      testCompleted: progress.testCompleted,
      testScore: progress.testScore,
      bestScore: progress.bestScore,
      gateUnlocked: progress.gateUnlocked,
    };
  }

  private async saveReviews(userId: string, reviews: WordResult[]) {
    if (reviews.length === 0) return;
    await this.prisma.wordReview.createMany({
      data: reviews.map(({ wordId, correct }) => ({ userId, wordId, correct })),
    });
  }
}
