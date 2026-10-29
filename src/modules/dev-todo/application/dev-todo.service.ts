import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import type {
  CreateDevTodoDto,
  ListDevTodoQuery,
  UpdateDevTodoDto,
} from './dev-todo.schema.js';

@Injectable()
export class DevTodoService {
  constructor(private prisma: PrismaService) {}

  list(query: ListDevTodoQuery) {
    return this.prisma.devTodo.findMany({
      where: { status: query.status, category: query.category },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(dto: CreateDevTodoDto) {
    return this.prisma.devTodo.create({
      data: {
        ...dto,
        completedAt: dto.status === 'done' ? new Date() : null,
      },
    });
  }

  async update(id: string, dto: UpdateDevTodoDto) {
    const existing = await this.prisma.devTodo.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Todo not found');

    let completedAt = existing.completedAt;
    if (dto.status && dto.status !== existing.status) {
      completedAt = dto.status === 'done' ? new Date() : null;
    }
    return this.prisma.devTodo.update({
      where: { id },
      data: { ...dto, completedAt },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.devTodo.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Todo not found');
    await this.prisma.devTodo.delete({ where: { id } });
    return { success: true };
  }
}
