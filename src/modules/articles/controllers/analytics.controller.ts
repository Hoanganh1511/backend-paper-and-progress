import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { viewSchema } from '../articles.schema.js';
import { parse, type OptionalAuthedRequest } from '../parse.js';
import { AnalyticsService } from '../services/analytics.service.js';

const statsQuery = z.object({
  sort: z
    .enum(['views', 'reactions', 'bookmarks', 'completion'])
    .default('views'),
  direction: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

@Controller('api/v1')
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  /** No login needed; a visitor is told apart by user id or IP address. */
  @Post('articles/:id/views')
  @HttpCode(200)
  @UseGuards(OptionalJwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  view(
    @Req() req: OptionalAuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const { maxScrollPercent } = parse(viewSchema, body);
    return this.analytics.recordView(
      id,
      { key: req.user?.sub ?? req.ip ?? 'unknown', userId: req.user?.sub },
      maxScrollPercent,
    );
  }

  @Get('admin/articles/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  stats(@Query() query: unknown) {
    return this.analytics.adminStats(parse(statsQuery, query));
  }
}
