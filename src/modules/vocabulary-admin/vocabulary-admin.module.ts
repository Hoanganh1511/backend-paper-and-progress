import { Module } from '@nestjs/common';
import { VocabularyAdminController } from './vocabulary-admin.controller.js';
import { VocabularyAdminService } from './vocabulary-admin.service.js';

@Module({
  controllers: [VocabularyAdminController],
  providers: [VocabularyAdminService],
})
export class VocabularyAdminModule {}
