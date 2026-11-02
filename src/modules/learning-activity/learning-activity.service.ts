import { BadRequestException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DailyGateService } from '../daily-gate/services/daily-gate.service.js';
import { LearningActivityRepository } from './repositories/learning-activity.repository.js';
import {
  buildCalendarDays,
  buildDayActivities,
} from './services/activity-aggregator.js';
import {
  dateColumnKey,
  isValidDateKey,
  monthDayKeys,
  monthEndKey,
  monthStartKey,
  TIMEZONE,
} from './services/ict-date.js';
import { computeStreaks } from './services/learning-streak.js';
import { LEARNING_GOAL } from './learning-goal.js';

export const calendarQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export const dayParamSchema = z
  .string()
  .refine(isValidDateKey, 'Ngày phải có dạng YYYY-MM-DD và có thật.');

@Injectable()
export class LearningActivityService {
  constructor(
    private repository: LearningActivityRepository,
    private dailyGate: DailyGateService,
  ) {}

  /** Today in the same sense as the Daily Gate, so both agree on the date. */
  private today(): string {
    return dateColumnKey(this.dailyGate.today());
  }

  /**
   * One month for the grid plus the overview numbers. Without `year` and
   * `month` it is the month of today.
   */
  async getCalendar(userId: string, query: { year?: number; month?: number }) {
    const today = this.today();
    const year = query.year ?? Number(today.slice(0, 4));
    const month = query.month ?? Number(today.slice(5, 7));
    if ((query.year === undefined) !== (query.month === undefined)) {
      throw new BadRequestException(
        'Cần cả year và month, hoặc không có cái nào.',
      );
    }

    const first = monthStartKey(year, month);
    const last = monthEndKey(year, month);
    const [lessons, phrases, allDays] = await Promise.all([
      this.repository.lessonProgress(userId, first, last),
      this.repository.phraseEvents(userId, first, last),
      this.repository.allActiveDays(userId),
    ]);

    const activities = buildDayActivities(lessons, phrases);
    const days = buildCalendarDays(
      monthDayKeys(year, month),
      activities,
      today,
    );
    const streaks = computeStreaks(allDays, today);

    return {
      today,
      goal: LEARNING_GOAL,
      month: { year, month, timezone: TIMEZONE, daysInMonth: days.length },
      summary: {
        learningDaysInMonth: days.filter((day) => day.hasActivity).length,
        learningDaysTotal: new Set(allDays.filter((day) => day <= today)).size,
        currentStreak: streaks.current,
        longestStreak: streaks.longest,
      },
      days,
    };
  }

  /** What the user did on one day. A day after today has none. */
  async getDay(userId: string, date: string) {
    const today = this.today();
    if (date > today) {
      return {
        date,
        hasActivity: false,
        summary: this.summary([]),
        activities: [],
      };
    }
    const [lessons, phrases] = await Promise.all([
      this.repository.lessonProgress(userId, date, date),
      this.repository.phraseEvents(userId, date, date),
    ]);
    const activities = buildDayActivities(lessons, phrases).get(date) ?? [];
    return {
      date,
      hasActivity: activities.length > 0,
      summary: this.summary(activities),
      activities,
    };
  }

  /**
   * `durationMinutes` stays null: nothing records how long a learner studied,
   * and a time worked out from counts would be made up.
   */
  private summary(activities: unknown[]) {
    return { activityCount: activities.length, durationMinutes: null };
  }
}
