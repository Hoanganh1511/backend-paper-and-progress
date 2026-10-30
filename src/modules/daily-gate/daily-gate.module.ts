import { Module } from '@nestjs/common';
import { DailyGateController } from './controllers/daily-gate.controller.js';
import { DailyGateService } from './services/daily-gate.service.js';
import { QuizGeneratorService } from './services/quiz-generator.service.js';
import { VocabularyService } from './services/vocabulary.service.js';

@Module({
  controllers: [DailyGateController],
  providers: [DailyGateService, VocabularyService, QuizGeneratorService],
})
export class DailyGateModule {}
