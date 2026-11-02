import { Module } from '@nestjs/common';
import { DailyGateController } from './controllers/daily-gate.controller.js';
import { PhraseController } from './controllers/phrase.controller.js';
import { DailyGateService } from './services/daily-gate.service.js';
import { PhraseService } from './services/phrase.service.js';
import { QuizGeneratorService } from './services/quiz-generator.service.js';
import { VocabularyService } from './services/vocabulary.service.js';

@Module({
  controllers: [DailyGateController, PhraseController],
  providers: [
    DailyGateService,
    VocabularyService,
    QuizGeneratorService,
    PhraseService,
  ],
  // The learning calendar asks it for "today", so both use the same date.
  exports: [DailyGateService],
})
export class DailyGateModule {}
