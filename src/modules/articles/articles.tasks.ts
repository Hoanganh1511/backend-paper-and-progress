import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AnalyticsService } from './services/analytics.service.js';
import { ArticlesService } from './services/articles.service.js';

/** Background jobs of the articles module. */
@Injectable()
export class ArticlesTasks {
  private readonly logger = new Logger(ArticlesTasks.name);

  constructor(
    private articles: ArticlesService,
    private analytics: AnalyticsService,
  ) {}

  @Cron('* * * * *')
  async publishScheduled() {
    try {
      const count = await this.articles.publishDue();
      if (count > 0) this.logger.log(`Published ${count} scheduled article(s)`);
    } catch (error) {
      this.logger.error(`publishDue failed: ${String(error)}`);
    }
  }

  @Cron('*/5 * * * *')
  async flushViews() {
    try {
      await this.analytics.flushViews();
    } catch (error) {
      this.logger.error(`flushViews failed: ${String(error)}`);
    }
  }
}
