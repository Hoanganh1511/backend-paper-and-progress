import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DailyLesson, UserDailyProgress } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import type { SubmitLearnDto } from '../dto/submit-learn.dto.js';
import type { SubmitPracticeDto } from '../dto/submit-practice.dto.js';
import type { SubmitTestDto } from '../dto/submit-test.dto.js';
import type { PracticeAnswer, WordResult } from '../types/quiz.types.js';
import { QuizGeneratorService, hashSeed } from './quiz-generator.service.js';
import { VocabularyService } from './vocabulary.service.js';

export const PASS_SCORE = 70;
/** A lesson with fewer words than this is "not ready": its words are still to be written. */
export const MIN_READY_WORDS = 15;
const TEST_QUESTIONS = 10;
const FINAL_TEST_QUESTIONS = 30;
const TEST_SECONDS = 300;
const FINAL_TEST_SECONDS = 900;
const CACHE_MS = 60_000;

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

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
    const [units, progress] = await Promise.all([
      this.vocabulary.unitsByIds(lesson.unitIds),
      this.ensureProgress(userId, lesson.id),
    ]);
    return {
      active: true as const,
      lessonId: lesson.id,
      dayNumber: lesson.dayNumber,
      date: dateKey(lesson.date),
      type: lesson.type,
      units,
      totalWords: wordCount,
      // false while the words of these units are still to be written
      isReady: wordCount >= MIN_READY_WORDS,
      progress: this.publicProgress(progress),
    };
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
        words: section.words.map((word) => ({
          id: word.id,
          word: word.word,
          meaning: word.meaning,
          example: word.example,
          contrast: word.contrast,
          forms: word.forms,
          pattern: word.pattern,
        })),
      })),
      totalWords: words.length,
    };
  }

  async completeLearn(userId: string, { lessonId }: SubmitLearnDto) {
    const { lesson } = await this.requireReadyLesson(lessonId);
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
