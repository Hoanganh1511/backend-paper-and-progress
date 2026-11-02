import {
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { parse } from '../../shared/pipes/zod-parse.js';
import { KnowledgeService } from './knowledge.service.js';
import { SearchService } from './search.service.js';

type AuthedRequest = { user: { sub: string } };
type OptionalAuthedRequest = { user?: { sub: string } };

const topicsQuery = z.object({
  q: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const searchQuery = z.object({
  q: z.string().trim().min(2, 'Nhập ít nhất 2 ký tự để tìm.').max(100),
  /** Limit per group. */
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

@Controller('api/v1')
export class KnowledgeController {
  constructor(
    private knowledge: KnowledgeService,
    private search: SearchService,
  ) {}

  @Get('knowledge/domains')
  domains() {
    return this.knowledge.listDomains();
  }

  @Get('knowledge/categories/:slug')
  category(@Param('slug') slug: string) {
    return this.knowledge.getCategory(slug);
  }

  // Before `topics/:slug`, or "followed" would be read as a slug.
  @Get('knowledge/topics')
  topics(@Query() query: unknown) {
    const { q, limit } = parse(topicsQuery, query);
    return this.knowledge.searchTopics(q, limit);
  }

  @Get('knowledge/followed')
  @UseGuards(JwtAuthGuard)
  followed(@Req() req: AuthedRequest) {
    return this.knowledge.followed(req.user.sub);
  }

  @Get('knowledge/topics/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  topic(@Req() req: OptionalAuthedRequest, @Param('slug') slug: string) {
    return this.knowledge.getTopic(slug, req.user?.sub);
  }

  @Put('knowledge/topics/:slug/follow')
  @UseGuards(JwtAuthGuard)
  follow(@Req() req: AuthedRequest, @Param('slug') slug: string) {
    return this.knowledge.follow(req.user.sub, slug);
  }

  @Delete('knowledge/topics/:slug/follow')
  @UseGuards(JwtAuthGuard)
  unfollow(@Req() req: AuthedRequest, @Param('slug') slug: string) {
    return this.knowledge.unfollow(req.user.sub, slug);
  }

  /** Results in groups (topics, resources, articles, paths), never one mixed list. */
  @Get('search')
  find(@Query() query: unknown) {
    const { q, limit } = parse(searchQuery, query);
    return this.search.search(q, limit);
  }
}
