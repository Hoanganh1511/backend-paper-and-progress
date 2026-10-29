import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { ZodType } from 'zod';
import { DevTodoService } from '../../application/dev-todo.service.js';
import {
  createDevTodoSchema,
  listDevTodoQuerySchema,
  updateDevTodoSchema,
} from '../../application/dev-todo.schema.js';
import { DevOnlyGuard } from '../guards/dev-only.guard.js';

function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException(result.error.issues);
  return result.data;
}

@Controller('api/v1/dev-todos')
@UseGuards(DevOnlyGuard)
export class DevTodoController {
  constructor(private service: DevTodoService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.service.list(parse(listDevTodoQuerySchema, query));
  }

  @Post()
  create(@Body() body: unknown) {
    return this.service.create(parse(createDevTodoSchema, body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.service.update(id, parse(updateDevTodoSchema, body));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
