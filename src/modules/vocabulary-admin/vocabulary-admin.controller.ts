import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { ZodType } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { VocabularyAdminService } from './vocabulary-admin.service.js';
import {
  createVocabularySchema,
  listVocabularyQuerySchema,
  updateVocabularySchema,
} from './vocabulary-admin.schema.js';

function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException(result.error.issues.map((i) => i.message));
  }
  return result.data;
}

@Controller('api/v1/admin/vocabulary')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class VocabularyAdminController {
  constructor(private service: VocabularyAdminService) {}

  // `meta` comes before ':id', or it would be read as an id.
  @Get('meta')
  meta() {
    return this.service.meta();
  }

  @Get()
  list(@Query() query: unknown) {
    return this.service.list(parse(listVocabularyQuerySchema, query));
  }

  @Post()
  create(@Body() body: unknown) {
    return this.service.create(parse(createVocabularySchema, body));
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.service.update(id, parse(updateVocabularySchema, body));
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
