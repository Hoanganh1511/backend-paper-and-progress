import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service.js';
import type {
  CreateTodoDto,
  ListTodosQuery,
  UpdateTodoDto,
} from './todos.schema.js';

const MAX_TODOS_PER_LIST = 500;

// "" cũng là xoá ghi chú
const toNote = (value: string | null | undefined) =>
  value === undefined ? undefined : value || null;

// undefined = không đổi, null = xoá hạn
const toDate = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : new Date(value);

// Mọi truy vấn đều kèm userId: user không đọc/sửa/xoá được todo của người khác
@Injectable()
export class TodosService {
  constructor(private prisma: PrismaService) {}

  list(userId: string, { status, search }: ListTodosQuery) {
    return this.prisma.todo.findMany({
      where: {
        userId,
        ...(status && { status }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { note: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_TODOS_PER_LIST,
    });
  }

  create(userId: string, dto: CreateTodoDto) {
    return this.prisma.todo.create({
      data: {
        ...dto,
        note: toNote(dto.note),
        dueDate: toDate(dto.dueDate),
        userId,
        completedAt: dto.status === 'done' ? new Date() : null,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateTodoDto) {
    const existing = await this.findOwned(userId, id);

    let completedAt = existing.completedAt;
    if (dto.status && dto.status !== existing.status) {
      completedAt = dto.status === 'done' ? new Date() : null;
    }
    const data: Prisma.TodoUpdateInput = {
      ...dto,
      note: toNote(dto.note),
      dueDate: toDate(dto.dueDate),
      completedAt,
    };
    return this.prisma.todo.update({ where: { id }, data });
  }

  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.todo.delete({ where: { id } });
    return { success: true };
  }

  private async findOwned(userId: string, id: string) {
    const todo = await this.prisma.todo.findFirst({ where: { id, userId } });
    if (!todo) throw new NotFoundException('Không tìm thấy ghi chú');
    return todo;
  }
}
