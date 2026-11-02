import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { ReactionType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard.js';
import { commentSchema } from '../articles.schema.js';
import {
  parse,
  type AuthedRequest,
  type OptionalAuthedRequest,
} from '../parse.js';
import { CommentsService } from '../services/comments.service.js';
import { EngagementService } from '../services/engagement.service.js';

const REACTIONS = ['LIKE', 'LOVE', 'INSIGHTFUL', 'CELEBRATE'];

function reactionOf(value: string): ReactionType {
  const type = value.toUpperCase();
  if (!REACTIONS.includes(type)) {
    throw new BadRequestException('Loại reaction không hợp lệ.');
  }
  return type as ReactionType;
}

@Controller('api/v1')
export class EngagementController {
  constructor(
    private engagement: EngagementService,
    private comments: CommentsService,
  ) {}

  @Get('articles/:id/engagement')
  @UseGuards(OptionalJwtAuthGuard)
  summary(@Req() req: OptionalAuthedRequest, @Param('id') id: string) {
    return this.engagement.summary(id, req.user?.sub);
  }

  @Put('articles/:id/reactions/:type')
  @UseGuards(JwtAuthGuard)
  react(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('type') type: string,
  ) {
    return this.engagement.react(id, req.user.sub, reactionOf(type));
  }

  @Delete('articles/:id/reactions/:type')
  @UseGuards(JwtAuthGuard)
  unreact(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('type') type: string,
  ) {
    return this.engagement.unreact(id, req.user.sub, reactionOf(type));
  }

  @Put('articles/:id/bookmark')
  @UseGuards(JwtAuthGuard)
  bookmark(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.engagement.bookmark(id, req.user.sub);
  }

  @Delete('articles/:id/bookmark')
  @UseGuards(JwtAuthGuard)
  unbookmark(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.engagement.unbookmark(id, req.user.sub);
  }

  @Get('bookmarks')
  @UseGuards(JwtAuthGuard)
  bookmarks(@Req() req: AuthedRequest) {
    return this.engagement.listBookmarks(req.user.sub);
  }

  /* Comments */

  @Get('articles/:id/comments')
  @UseGuards(OptionalJwtAuthGuard)
  tree(@Req() req: OptionalAuthedRequest, @Param('id') id: string) {
    return this.comments.tree(id, req.user);
  }

  @Post('articles/:id/comments')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  addComment(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.comments.create(req.user, id, parse(commentSchema, body));
  }

  @Delete('comments/:id')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  removeComment(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.comments.remove(req.user, id);
  }
}
