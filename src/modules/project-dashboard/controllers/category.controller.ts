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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CategoryService } from '../services/category.service.js';
import { CreateCategoryDto } from '../dto/create-category.dto.js';
import { UpdateCategoryDto } from '../dto/update-category.dto.js';
import { ReorderDto } from '../dto/query.dto.js';

@Controller('api/v1/project-dashboard/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CategoryController {
  constructor(private categories: CategoryService) {}

  @Get()
  list() {
    return this.categories.list();
  }

  // Phải khai báo trước ':id' để 'reorder' không bị hiểu là id
  @Patch('reorder')
  reorder(@Body() dto: ReorderDto) {
    return this.categories.reorder(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.get(id);
  }

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.remove(id);
  }
}
