import { BadRequestException } from '@nestjs/common';
import type { ZodType } from 'zod';

/** Validates a body, query or parameter with a zod schema; the message lists every problem. */
export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException(result.error.issues.map((i) => i.message));
  }
  return result.data;
}
