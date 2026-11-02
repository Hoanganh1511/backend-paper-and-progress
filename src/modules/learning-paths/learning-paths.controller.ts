import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { parse } from '../../shared/pipes/zod-parse.js';
import {
  LearningPathsService,
  listPathsSchema,
  stepProgressSchema,
} from './learning-paths.service.js';

type AuthedRequest = { user: { sub: string } };
type OptionalAuthedRequest = { user?: { sub: string } };

/** Anyone may read the paths; progress, checklist and notes belong to the signed-in user. */
@Controller('api/v1/paths')
export class LearningPathsController {
  constructor(private paths: LearningPathsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(@Req() req: OptionalAuthedRequest, @Query() query: unknown) {
    return this.paths.list(parse(listPathsSchema, query), req.user?.sub);
  }

  // Before `:slug`, or "mine" would be read as a slug.
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@Req() req: AuthedRequest) {
    return this.paths.myPaths(req.user.sub);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  get(@Req() req: OptionalAuthedRequest, @Param('slug') slug: string) {
    return this.paths.getBySlug(slug, req.user?.sub);
  }

  @Post(':slug/start')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  start(@Req() req: AuthedRequest, @Param('slug') slug: string) {
    return this.paths.start(req.user.sub, slug);
  }

  @Get(':slug/steps/:stepSlug')
  @UseGuards(OptionalJwtAuthGuard)
  step(
    @Req() req: OptionalAuthedRequest,
    @Param('slug') slug: string,
    @Param('stepSlug') stepSlug: string,
  ) {
    return this.paths.getStep(slug, stepSlug, req.user?.sub);
  }

  @Put(':slug/steps/:stepSlug/progress')
  @UseGuards(JwtAuthGuard)
  saveProgress(
    @Req() req: AuthedRequest,
    @Param('slug') slug: string,
    @Param('stepSlug') stepSlug: string,
    @Body() body: unknown,
  ) {
    return this.paths.saveStepProgress(
      req.user.sub,
      slug,
      stepSlug,
      parse(stepProgressSchema, body),
    );
  }
}
