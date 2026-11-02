import { Module } from '@nestjs/common';
import { DailyGateModule } from '../daily-gate/daily-gate.module.js';
import { LearningActivityController } from './learning-activity.controller.js';
import { LearningActivityService } from './learning-activity.service.js';
import { LearningActivityRepository } from './repositories/learning-activity.repository.js';

/** The learning calendar: one place that adds up what the Daily Gate and the Phrase Book saved. */
@Module({
  imports: [DailyGateModule],
  controllers: [LearningActivityController],
  providers: [LearningActivityService, LearningActivityRepository],
})
export class LearningActivityModule {}
