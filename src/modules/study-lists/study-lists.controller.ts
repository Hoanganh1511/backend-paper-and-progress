import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ZodType } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { StudyListsService } from './study-lists.service.js';
import {
  createStepSchema,
  createStudyListSchema,
  reorderSchema,
  searchArticlesSchema,
  sectionSchema,
  updateSectionSchema,
  updateStepSchema,
  updateStudyListSchema,
} from './study-lists.schema.js';

type AuthedRequest = { user: { sub: string } };

function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException(result.error.issues.map((i) => i.message));
  }
  return result.data;
}

// The fixed paths (sections/..., steps/...) come before the ':id' routes.
@Controller('api/v1/study-lists')
@UseGuards(JwtAuthGuard)
export class StudyListsController {
  constructor(private service: StudyListsService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.service.list(req.user.sub);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.service.create(
      req.user.sub,
      parse(createStudyListSchema, body),
    );
  }

  /** The articles a step can point to: published ones, and the learner's own drafts. */
  @Get('articles')
  searchArticles(@Req() req: AuthedRequest, @Query() query: unknown) {
    return this.service.searchArticles(
      req.user.sub,
      parse(searchArticlesSchema, query),
    );
  }

  @Patch('sections/:sectionId')
  updateSection(
    @Req() req: AuthedRequest,
    @Param('sectionId') sectionId: string,
    @Body() body: unknown,
  ) {
    return this.service.updateSection(
      req.user.sub,
      sectionId,
      parse(updateSectionSchema, body),
    );
  }

  @Delete('sections/:sectionId')
  @HttpCode(200)
  removeSection(
    @Req() req: AuthedRequest,
    @Param('sectionId') sectionId: string,
  ) {
    return this.service.removeSection(req.user.sub, sectionId);
  }

  @Post('sections/:sectionId/steps')
  addStep(
    @Req() req: AuthedRequest,
    @Param('sectionId') sectionId: string,
    @Body() body: unknown,
  ) {
    return this.service.addStep(
      req.user.sub,
      sectionId,
      parse(createStepSchema, body),
    );
  }

  @Put('sections/:sectionId/steps/order')
  reorderSteps(
    @Req() req: AuthedRequest,
    @Param('sectionId') sectionId: string,
    @Body() body: unknown,
  ) {
    return this.service.reorderSteps(
      req.user.sub,
      sectionId,
      parse(reorderSchema, body).ids,
    );
  }

  @Patch('steps/:stepId')
  updateStep(
    @Req() req: AuthedRequest,
    @Param('stepId') stepId: string,
    @Body() body: unknown,
  ) {
    return this.service.updateStep(
      req.user.sub,
      stepId,
      parse(updateStepSchema, body),
    );
  }

  @Delete('steps/:stepId')
  @HttpCode(200)
  removeStep(@Req() req: AuthedRequest, @Param('stepId') stepId: string) {
    return this.service.removeStep(req.user.sub, stepId);
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.get(req.user.sub, id);
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.update(
      req.user.sub,
      id,
      parse(updateStudyListSchema, body),
    );
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.remove(req.user.sub, id);
  }

  @Post(':id/sections')
  addSection(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.addSection(
      req.user.sub,
      id,
      parse(sectionSchema, body),
    );
  }

  @Put(':id/sections/order')
  reorderSections(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.reorderSections(
      req.user.sub,
      id,
      parse(reorderSchema, body).ids,
    );
  }
}
