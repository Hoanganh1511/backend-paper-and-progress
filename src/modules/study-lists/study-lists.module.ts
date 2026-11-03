import { Module } from '@nestjs/common';
import { StudyListsController } from './study-lists.controller.js';
import { StudyListsService } from './study-lists.service.js';

@Module({
  controllers: [StudyListsController],
  providers: [StudyListsService],
})
export class StudyListsModule {}
