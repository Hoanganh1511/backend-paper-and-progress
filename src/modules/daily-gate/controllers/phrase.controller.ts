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
import {
  AddExampleDto,
  CreatePhraseDto,
  ListPhrasesQuery,
  ReviewPhraseDto,
  SpokenAttemptDto,
  UpdatePhraseDto,
} from '../dto/phrase.dto.js';
import { PhraseService } from '../services/phrase.service.js';

type AuthedRequest = { user: { sub: string } };

@Controller('api/v1/daily-gate/phrases')
@UseGuards(JwtAuthGuard)
export class PhraseController {
  constructor(private phrases: PhraseService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query() query: ListPhrasesQuery) {
    return this.phrases.list(req.user.sub, query);
  }

  // Declared before `:id`, or "summary" would be read as an id.
  @Get('summary')
  summary(@Req() req: AuthedRequest) {
    return this.phrases.summary(req.user.sub);
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.phrases.get(req.user.sub, id);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreatePhraseDto) {
    return this.phrases.create(req.user.sub, dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePhraseDto,
  ) {
    return this.phrases.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.phrases.remove(req.user.sub, id);
  }

  @Post(':id/examples')
  addExample(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: AddExampleDto,
  ) {
    return this.phrases.addExample(req.user.sub, id, dto);
  }

  @Post(':id/review')
  @HttpCode(200)
  review(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: ReviewPhraseDto,
  ) {
    return this.phrases.review(req.user.sub, id, dto);
  }

  @Post(':id/spoken')
  @HttpCode(200)
  spoken(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: SpokenAttemptDto,
  ) {
    return this.phrases.recordSpoken(req.user.sub, id, dto);
  }
}
