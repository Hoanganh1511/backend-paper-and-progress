import { z } from 'zod';

export const TODO_STATUSES = ['pending', 'in_progress', 'done'] as const;
export const TODO_PRIORITIES = ['low', 'medium', 'high'] as const;

const title = z.string().trim().min(1).max(255);
const note = z.string().trim().max(5000);
// "2026-11-05" or a full ISO date-time; null clears the due date
const dueDate = z.string().datetime({ offset: true }).or(z.string().date());

export const createTodoSchema = z.object({
  title,
  note: note.nullish(),
  status: z.enum(TODO_STATUSES).optional(),
  priority: z.enum(TODO_PRIORITIES).optional(),
  dueDate: dueDate.nullish(),
});

export const updateTodoSchema = z.object({
  title: title.optional(),
  note: note.nullish(),
  status: z.enum(TODO_STATUSES).optional(),
  priority: z.enum(TODO_PRIORITIES).optional(),
  dueDate: dueDate.nullish(),
});

export const listTodosQuerySchema = z.object({
  status: z.enum(TODO_STATUSES).optional(),
  /** Tìm trong tiêu đề và ghi chú (không phân biệt hoa thường) */
  search: z.string().trim().min(1).max(100).optional(),
});

export type CreateTodoDto = z.infer<typeof createTodoSchema>;
export type UpdateTodoDto = z.infer<typeof updateTodoSchema>;
export type ListTodosQuery = z.infer<typeof listTodosQuerySchema>;
