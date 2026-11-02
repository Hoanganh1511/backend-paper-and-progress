import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { seriesSchema, tagSchema } from '../articles.schema.js';
import { parse } from '../parse.js';
import { TaxonomyService } from '../services/taxonomy.service.js';

@Controller('api/v1/tags')
export class TagsController {
  constructor(private taxonomy: TaxonomyService) {}

  @Get()
  list() {
    return this.taxonomy.listTags();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CREATOR', 'ADMIN')
  create(@Body() body: unknown) {
    return this.taxonomy.createTag(parse(tagSchema, body).name);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  rename(@Param('id') id: string, @Body() body: unknown) {
    return this.taxonomy.renameTag(id, parse(tagSchema, body).name);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.taxonomy.deleteTag(id);
  }
}

@Controller('api/v1/series')
export class SeriesController {
  constructor(private taxonomy: TaxonomyService) {}

  @Get()
  list() {
    return this.taxonomy.listSeries();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CREATOR', 'ADMIN')
  create(@Body() body: unknown) {
    return this.taxonomy.createSeries(parse(seriesSchema, body));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CREATOR', 'ADMIN')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.taxonomy.updateSeries(id, parse(seriesSchema, body));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.taxonomy.deleteSeries(id);
  }
}
