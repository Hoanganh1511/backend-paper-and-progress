import { z } from 'zod';

export const TODO_STATUSES = ['pending', 'in_progress', 'done'] as const;
export const TODO_PRIORITIES = ['low', 'medium', 'high'] as const;

export const createDevTodoSchema = z.object({
  title: z.string().trim().min(1).max(255),
  status: z.enum(TODO_STATUSES).optional(),
  priority: z.enum(TODO_PRIORITIES).optional(),
  category: z.string().trim().min(1).optional(),
});

export const updateDevTodoSchema = createDevTodoSchema.partial();

export const listDevTodoQuerySchema = z.object({
  status: z.enum(TODO_STATUSES).optional(),
  category: z.string().trim().min(1).optional(),
});

export type CreateDevTodoDto = z.infer<typeof createDevTodoSchema>;
export type UpdateDevTodoDto = z.infer<typeof updateDevTodoSchema>;
export type ListDevTodoQuery = z.infer<typeof listDevTodoQuerySchema>;
