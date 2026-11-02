import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { MembershipModule } from '../membership/membership.module.js';
import { ArticlesTasks } from './articles.tasks.js';
import { AnalyticsController } from './controllers/analytics.controller.js';
import { ArticlesController } from './controllers/articles.controller.js';
import { EngagementController } from './controllers/engagement.controller.js';
import {
  SeriesController,
  TagsController,
} from './controllers/taxonomy.controller.js';
import { UploadController } from './controllers/upload.controller.js';
import { AnalyticsService } from './services/analytics.service.js';
import { ArticleCacheService } from './services/article-cache.service.js';
import { ArticlesService } from './services/articles.service.js';
import { CommentsService } from './services/comments.service.js';
import { ContentService } from './services/content.service.js';
import { EngagementService } from './services/engagement.service.js';
import { redisProvider } from './services/redis.provider.js';
import { RevalidateService } from './services/revalidate.service.js';
import { RevisionsService } from './services/revisions.service.js';
import { TaxonomyService } from './services/taxonomy.service.js';
import { UploadService } from './services/upload.service.js';

@Module({
  imports: [
    MembershipModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
  controllers: [
    ArticlesController,
    TagsController,
    SeriesController,
    EngagementController,
    UploadController,
    AnalyticsController,
  ],
  providers: [
    redisProvider,
    ContentService,
    RevisionsService,
    ArticleCacheService,
    RevalidateService,
    ArticlesService,
    TaxonomyService,
    CommentsService,
    EngagementService,
    AnalyticsService,
    UploadService,
    ArticlesTasks,
  ],
})
export class ArticlesModule {}
