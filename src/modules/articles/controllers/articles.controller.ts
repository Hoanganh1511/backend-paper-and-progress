import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import {
  createArticleSchema,
  listArticlesSchema,
  publishArticleSchema,
  updateArticleSchema,
} from '../articles.schema.js';
import {
  parse,
  type AuthedRequest,
  type OptionalAuthedRequest,
} from '../parse.js';
import { ArticlesService } from '../services/articles.service.js';

@Controller('api/v1/articles')
export class ArticlesController {
  constructor(private articles: ArticlesService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.articles.list(parse(listArticlesSchema, query));
  }

  // Declared before `:slug`, or "mine" would be read as a slug.
  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CREATOR', 'ADMIN')
  mine(@Req() req: AuthedRequest) {
    return this.articles.mine(req.user);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  get(@Req() req: OptionalAuthedRequest, @Param('slug') slug: string) {
    return this.articles.getBySlug(slug, req.user);
  }

  @Get(':id/editable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CREATOR', 'ADMIN')
  editable(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.articles.getEditable(req.user, id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CREATOR', 'ADMIN')
  create(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.articles.create(req.user, parse(createArticleSchema, body));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CREATOR', 'ADMIN')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.articles.update(req.user, id, parse(updateArticleSchema, body));
  }

  @Post(':id/publish')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CREATOR', 'ADMIN')
  publish(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const { scheduledAt } = parse(publishArticleSchema, body ?? {});
    return this.articles.publish(req.user, id, scheduledAt);
  }

  @Post(':id/duplicate')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CREATOR', 'ADMIN')
  duplicate(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.articles.duplicate(req.user, id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CREATOR', 'ADMIN')
  archive(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.articles.archive(req.user, id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CREATOR', 'ADMIN')
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.articles.remove(req.user, id);
  }

  @Get(':id/revisions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CREATOR', 'ADMIN')
  revisions(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.articles.listRevisions(req.user, id);
  }

  @Post(':id/revisions/:revisionId/restore')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CREATOR', 'ADMIN')
  restore(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
  ) {
    return this.articles.restoreRevision(req.user, id, revisionId);
  }
}
