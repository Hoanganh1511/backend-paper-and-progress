import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import type {
  LessonProgressRow,
  PhraseEvents,
} from '../types/learning-activity.type.js';
import { dateColumnKey, instantRange, TIMEZONE } from '../services/ict-date.js';

/** Reads what the learning modules saved. Nothing here writes. */
@Injectable()
export class LearningActivityRepository {
  constructor(private prisma: PrismaService) {}

  /** Lesson progress with at least one finished step, for lessons dated `firstKey` to `lastKey`. */
  async lessonProgress(
    userId: string,
    firstKey: string,
    lastKey: string,
  ): Promise<LessonProgressRow[]> {
    const rows = await this.prisma.userDailyProgress.findMany({
      where: {
        userId,
        lesson: {
          date: {
            gte: new Date(`${firstKey}T00:00:00.000Z`),
            lte: new Date(`${lastKey}T00:00:00.000Z`),
          },
        },
        OR: [
          { learnCompleted: true },
          { practiceCompleted: true },
          { testCompleted: true },
        ],
      },
      include: { lesson: { select: { date: true, dayNumber: true } } },
    });
    return rows.map((row) => ({
      date: dateColumnKey(row.lesson.date),
      dayNumber: row.lesson.dayNumber,
      learnCompleted: row.learnCompleted,
      practiceCompleted: row.practiceCompleted,
      testCompleted: row.testCompleted,
      testScore: row.testScore,
      gateUnlocked: row.gateUnlocked,
      completedAt: row.completedAt,
    }));
  }

  /** Phrase Book actions that happened on the days `firstKey` to `lastKey` (Asia/Ho_Chi_Minh). */
  async phraseEvents(
    userId: string,
    firstKey: string,
    lastKey: string,
  ): Promise<PhraseEvents> {
    const { from, to } = instantRange(firstKey, lastKey);
    const within = { gte: from, lt: to };
    const [writes, recalls, spoken] = await Promise.all([
      this.prisma.phraseExample.findMany({
        where: { step: 'WRITE', createdAt: within, phrase: { userId } },
        select: { createdAt: true },
      }),
      this.prisma.phraseReview.findMany({
        where: { createdAt: within, phrase: { userId } },
        select: { createdAt: true, grade: true },
      }),
      this.prisma.phraseSpokenAttempt.findMany({
        where: { createdAt: within, phrase: { userId } },
        select: { createdAt: true, containsPhrase: true },
      }),
    ]);
    return {
      writes: writes.map((row) => row.createdAt),
      recalls: recalls.map((row) => ({ at: row.createdAt, grade: row.grade })),
      spoken: spoken.map((row) => ({
        at: row.createdAt,
        containsPhrase: row.containsPhrase,
      })),
    };
  }

  /**
   * Every day, in the whole history, on which the user did any of the same
   * things the calendar lists. Used for the streaks and the total, so they
   * follow the same rules as the grid.
   */
  async allActiveDays(userId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ day: string }[]>`
      SELECT DISTINCT day::text AS day FROM (
        SELECT l."date" AS day
          FROM "UserDailyProgress" p
          JOIN "DailyLesson" l ON l.id = p."lessonId"
          WHERE p."userId" = ${userId}
            AND (p."learnCompleted" OR p."practiceCompleted" OR p."testCompleted")
        UNION ALL
        SELECT ((e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TIMEZONE})::date
          FROM "PhraseExample" e
          JOIN "Phrase" ph ON ph.id = e."phraseId"
          WHERE ph."userId" = ${userId} AND e."step" = 'WRITE'
        UNION ALL
        SELECT ((r."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TIMEZONE})::date
          FROM "PhraseReview" r
          JOIN "Phrase" ph ON ph.id = r."phraseId"
          WHERE ph."userId" = ${userId}
        UNION ALL
        SELECT ((s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TIMEZONE})::date
          FROM "PhraseSpokenAttempt" s
          JOIN "Phrase" ph ON ph.id = s."phraseId"
          WHERE ph."userId" = ${userId}
      ) days`;
    return rows.map((row) => row.day);
  }
}
