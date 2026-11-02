import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller.js';
import { KnowledgeService } from './knowledge.service.js';
import { SearchService } from './search.service.js';

/** The Knowledge Library (domains, categories, topics) and the search across all content. */
@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService, SearchService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
