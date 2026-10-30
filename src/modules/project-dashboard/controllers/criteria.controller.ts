import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CriteriaService } from '../services/criteria.service.js';
import { CreateCriteriaDto } from '../dto/create-criteria.dto.js';
import { UpdateCriteriaDto } from '../dto/update-criteria.dto.js';
import { ListCriteriaDto, ReorderDto } from '../dto/query.dto.js';

@Controller('api/v1/project-dashboard/criteria')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CriteriaController {
  constructor(private criteria: CriteriaService) {}

  @Get()
  list(@Query() query: ListCriteriaDto) {
    return this.criteria.list(query);
  }

  // Phải khai báo trước ':id' để 'reorder' không bị hiểu là id
  @Patch('reorder')
  reorder(@Body() dto: ReorderDto) {
    return this.criteria.reorder(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.criteria.get(id);
  }

  @Post()
  create(@Body() dto: CreateCriteriaDto) {
    return this.criteria.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCriteriaDto,
  ) {
    return this.criteria.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.criteria.remove(id);
  }
}
