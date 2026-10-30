import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TodosService } from './todos.service.js';
import { createTodoSchema } from './todos.schema.js';

function setup() {
  const todo = {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn(),
    create: vi.fn().mockImplementation(({ data }) => data),
    update: vi.fn().mockImplementation(({ data }) => data),
    delete: vi.fn(),
  };
  const service = new TodosService({ todo } as never);
  return { service, todo };
}

describe('TodosService', () => {
  it('only lists the current user todos, filtered and searched', async () => {
    const { service, todo } = setup();
    await service.list('u1', { status: 'done', search: 'abc' });
    const where = todo.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: 'u1', status: 'done' });
    expect(where.OR).toHaveLength(2);
  });

  it('creates a todo for the user, done todos get completedAt', async () => {
    const { service, todo } = setup();
    await service.create('u1', { title: 'A', status: 'done' } as never);
    const data = todo.create.mock.calls[0][0].data;
    expect(data.userId).toBe('u1');
    expect(data.completedAt).toBeInstanceOf(Date);
  });

  it('404s for a todo that belongs to someone else', async () => {
    const { service, todo } = setup();
    todo.findFirst.mockResolvedValue(null);
    await expect(service.update('u1', 'x', { title: 'B' })).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.remove('u1', 'x')).rejects.toThrow(NotFoundException);
    expect(todo.findFirst).toHaveBeenCalledWith({
      where: { id: 'x', userId: 'u1' },
    });
    expect(todo.delete).not.toHaveBeenCalled();
  });

  it('sets completedAt on done and clears it when reopened', async () => {
    const { service, todo } = setup();
    todo.findFirst.mockResolvedValue({ status: 'pending', completedAt: null });
    await service.update('u1', 't', { status: 'done' });
    expect(todo.update.mock.calls[0][0].data.completedAt).toBeInstanceOf(Date);

    todo.findFirst.mockResolvedValue({
      status: 'done',
      completedAt: new Date(),
    });
    await service.update('u1', 't', { status: 'pending' });
    expect(todo.update.mock.calls[1][0].data.completedAt).toBeNull();
  });

  it('turns an empty note into null and leaves a missing one alone', async () => {
    const { service, todo } = setup();
    todo.findFirst.mockResolvedValue({ status: 'pending', completedAt: null });
    await service.update('u1', 't', { note: '' });
    expect(todo.update.mock.calls[0][0].data.note).toBeNull();
    await service.update('u1', 't', { title: 'x' });
    expect(todo.update.mock.calls[1][0].data.note).toBeUndefined();
  });

  it('keeps the due date unless told otherwise, and clears it on null', async () => {
    const { service, todo } = setup();
    todo.findFirst.mockResolvedValue({ status: 'pending', completedAt: null });
    await service.update('u1', 't', { title: 'x' });
    expect(todo.update.mock.calls[0][0].data.dueDate).toBeUndefined();
    await service.update('u1', 't', { dueDate: null });
    expect(todo.update.mock.calls[1][0].data.dueDate).toBeNull();
    await service.update('u1', 't', { dueDate: '2026-11-05' });
    expect(todo.update.mock.calls[2][0].data.dueDate).toBeInstanceOf(Date);
  });
});

describe('todo schemas', () => {
  it('rejects an empty title and an unknown status', () => {
    expect(createTodoSchema.safeParse({ title: '  ' }).success).toBe(false);
    expect(
      createTodoSchema.safeParse({ title: 'a', status: 'x' }).success,
    ).toBe(false);
  });

  it('accepts a plain date or an ISO date-time as the due date', () => {
    expect(
      createTodoSchema.safeParse({ title: 'a', dueDate: '2026-11-05' }).success,
    ).toBe(true);
    expect(
      createTodoSchema.safeParse({
        title: 'a',
        dueDate: '2026-11-05T10:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      createTodoSchema.safeParse({ title: 'a', dueDate: 'tomorrow' }).success,
    ).toBe(false);
  });
});
