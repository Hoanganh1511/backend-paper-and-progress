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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ZodType } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TodosService } from './todos.service.js';
import {
  createTodoSchema,
  listTodosQuerySchema,
  updateTodoSchema,
} from './todos.schema.js';

type AuthedRequest = { user: { sub: string } };

function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException(result.error.issues.map((i) => i.message));
  }
  return result.data;
}

@Controller('api/v1/todos')
@UseGuards(JwtAuthGuard)
export class TodosController {
  constructor(private service: TodosService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query() query: unknown) {
    return this.service.list(req.user.sub, parse(listTodosQuerySchema, query));
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.service.create(req.user.sub, parse(createTodoSchema, body));
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.update(req.user.sub, id, parse(updateTodoSchema, body));
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.remove(req.user.sub, id);
  }
}
