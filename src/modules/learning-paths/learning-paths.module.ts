import { Module } from '@nestjs/common';
import { LearningPathsController } from './learning-paths.controller.js';
import { LearningPathsService } from './learning-paths.service.js';

/** Learning Paths: phases and steps, and each user's progress, checklist and notes. */
@Module({
  controllers: [LearningPathsController],
  providers: [LearningPathsService],
})
export class LearningPathsModule {}
