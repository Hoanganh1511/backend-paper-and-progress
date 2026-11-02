import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LearningLevel, Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../shared/database/prisma.service.js';

export const NOTE_MAX = 5000;

export const listPathsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  topic: z.string().trim().max(100).optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
});

export const stepProgressSchema = z.object({
  isDone: z.boolean().optional(),
  /** { [checkId]: boolean } for the checklist items of the step. */
  checks: z.record(z.string().max(100), z.boolean()).optional(),
  note: z.string().max(NOTE_MAX).nullable().optional(),
});

export type ListPathsInput = z.infer<typeof listPathsSchema>;
export type StepProgressInput = z.infer<typeof stepProgressSchema>;

export type PathState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

/** The ids of the checklist items in a step's content (they may sit inside a "details" block). */
export function collectCheckIds(content: unknown): string[] {
  const ids: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node === null || typeof node !== 'object') return;
    const block = node as { type?: unknown; id?: unknown; content?: unknown };
    if (block.type === 'check' && typeof block.id === 'string') {
      ids.push(block.id);
    }
    if (block.content !== undefined) walk(block.content);
  };
  walk(content);
  return ids;
}

export function pathState(
  done: number,
  total: number,
  hasStarted: boolean,
): PathState {
  if (total > 0 && done >= total) return 'COMPLETED';
  return hasStarted || done > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';
}

/**
 * Total minutes when every step says how long it takes; otherwise null. A sum
 * over only some of the steps would be a wrong number, so it is not shown.
 */
export function totalMinutes(durations: (number | null)[]): number | null {
  if (durations.length === 0 || durations.some((minutes) => minutes === null)) {
    return null;
  }
  return durations.reduce<number>((sum, minutes) => sum + (minutes ?? 0), 0);
}

@Injectable()
export class LearningPathsService {
  constructor(private prisma: PrismaService) {}

  /* ------------------------------------------------------------------------ */
  /* Progress helpers                                                         */
  /* ------------------------------------------------------------------------ */

  /** What a user has done in each of the given paths (empty without a user). */
  private async progressOf(userId: string | undefined, pathIds: string[]) {
    const result = new Map<
      string,
      { startedAt: Date | null; done: Set<string>; lastStepId: string | null }
    >();
    for (const id of pathIds) {
      result.set(id, { startedAt: null, done: new Set(), lastStepId: null });
    }
    if (!userId || pathIds.length === 0) return result;
    const [started, doneSteps] = await Promise.all([
      this.prisma.userPathProgress.findMany({
        where: { userId, pathId: { in: pathIds } },
      }),
      this.prisma.userStepProgress.findMany({
        where: {
          userId,
          completedAt: { not: null },
          step: { pathId: { in: pathIds } },
        },
        select: { stepId: true, step: { select: { pathId: true } } },
      }),
    ]);
    for (const row of started) {
      const entry = result.get(row.pathId);
      if (entry) {
        entry.startedAt = row.startedAt;
        entry.lastStepId = row.lastStepId;
      }
    }
    for (const row of doneSteps)
      result.get(row.step.pathId)?.done.add(row.stepId);
    return result;
  }

  /* ------------------------------------------------------------------------ */
  /* Reading                                                                  */
  /* ------------------------------------------------------------------------ */

  async list(query: ListPathsInput, userId?: string) {
    const where: Prisma.LearningPathWhereInput = {
      status: 'PUBLISHED',
      ...(query.level ? { level: query.level as LearningLevel } : {}),
      ...(query.topic
        ? { topics: { some: { topic: { slug: query.topic } } } }
        : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const paths = await this.prisma.learningPath.findMany({
      where,
      orderBy: { order: 'asc' },
      include: {
        topics: { include: { topic: { select: { slug: true, name: true } } } },
        phases: { select: { id: true } },
        steps: { select: { id: true, durationMinutes: true } },
      },
    });
    const progress = await this.progressOf(
      userId,
      paths.map((path) => path.id),
    );
    return paths.map((path) => {
      const mine = progress.get(path.id);
      return {
        slug: path.slug,
        title: path.title,
        description: path.description,
        level: path.level,
        phaseCount: path.phases.length,
        stepCount: path.steps.length,
        totalMinutes: totalMinutes(path.steps.map((s) => s.durationMinutes)),
        topics: path.topics.map((row) => row.topic),
        // Only for a signed-in user; a path they have not begun carries no progress.
        progress: userId
          ? {
              state: pathState(
                mine?.done.size ?? 0,
                path.steps.length,
                mine?.startedAt != null,
              ),
              completedSteps: mine?.done.size ?? 0,
              totalSteps: path.steps.length,
            }
          : null,
      };
    });
  }

  private async requirePath(slug: string) {
    const path = await this.prisma.learningPath.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: {
        topics: {
          include: {
            topic: { select: { slug: true, name: true, icon: true } },
          },
        },
        phases: {
          orderBy: { order: 'asc' },
          include: {
            steps: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                slug: true,
                title: true,
                order: true,
                durationMinutes: true,
              },
            },
          },
        },
      },
    });
    if (!path) throw new NotFoundException('Không tìm thấy lộ trình này.');
    return path;
  }

  /** The path with its phases and steps, and where the user stands in it. */
  async getBySlug(slug: string, userId?: string) {
    const path = await this.requirePath(slug);
    const steps = path.phases.flatMap((phase) => phase.steps);
    const progress = (await this.progressOf(userId, [path.id])).get(path.id);
    const done = progress?.done ?? new Set<string>();
    const next = steps.find((step) => !done.has(step.id)) ?? null;

    // Articles and resources of the topics this path covers: referenced, not copied.
    const topicIds = await this.prisma.learningPathTopic.findMany({
      where: { pathId: path.id },
      select: { topicId: true },
    });
    const ids = topicIds.map((row) => row.topicId);
    const [articles, resources] = await Promise.all([
      this.prisma.article.findMany({
        where: {
          status: 'PUBLISHED',
          topics: { some: { topicId: { in: ids } } },
        },
        orderBy: { publishedAt: 'desc' },
        take: 4,
        select: {
          slug: true,
          title: true,
          excerpt: true,
          readingMinutes: true,
        },
      }),
      this.prisma.knowledgeResource.findMany({
        where: { topicId: { in: ids } },
        orderBy: { order: 'asc' },
        take: 6,
        select: { id: true, title: true, url: true },
      }),
    ]);

    return {
      slug: path.slug,
      title: path.title,
      description: path.description,
      level: path.level,
      objectives: path.objectives,
      prerequisites: path.prerequisites,
      outcomes: path.outcomes,
      phaseCount: path.phases.length,
      stepCount: steps.length,
      totalMinutes: totalMinutes(steps.map((s) => s.durationMinutes)),
      topics: path.topics.map((row) => row.topic),
      phases: path.phases.map((phase) => ({
        order: phase.order,
        title: phase.title,
        description: phase.description,
        completedSteps: phase.steps.filter((s) => done.has(s.id)).length,
        steps: phase.steps.map((step) => ({
          slug: step.slug,
          title: step.title,
          order: step.order,
          durationMinutes: step.durationMinutes,
          isDone: done.has(step.id),
        })),
      })),
      progress: userId
        ? {
            state: pathState(
              done.size,
              steps.length,
              progress?.startedAt != null,
            ),
            completedSteps: done.size,
            totalSteps: steps.length,
            startedAt: progress?.startedAt ?? null,
            // Where "Tiếp tục học" goes: the first step not finished yet.
            nextStepSlug: next?.slug ?? null,
          }
        : null,
      articles: articles.map((a) => ({ ...a })),
      resources: resources.map((r) => ({
        ...r,
        isExternal: !r.url.startsWith('/'),
      })),
    };
  }

  /** One step's content with its neighbours and, for a user, their own progress on it. */
  async getStep(slug: string, stepSlug: string, userId?: string) {
    const path = await this.prisma.learningPath.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: { id: true, title: true },
    });
    if (!path) throw new NotFoundException('Không tìm thấy lộ trình này.');
    const steps = await this.prisma.learningStep.findMany({
      where: { pathId: path.id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        order: true,
        phase: { select: { order: true, title: true } },
      },
    });
    const index = steps.findIndex((step) => step.slug === stepSlug);
    if (index < 0) throw new NotFoundException('Không tìm thấy bước này.');
    const current = steps[index];
    const step = await this.prisma.learningStep.findUniqueOrThrow({
      where: { id: current.id },
    });
    const mine = userId
      ? await this.prisma.userStepProgress.findUnique({
          where: { userId_stepId: { userId, stepId: step.id } },
        })
      : null;
    const neighbour = (item: (typeof steps)[number] | undefined) =>
      item ? { slug: item.slug, title: item.title } : null;
    return {
      path: { slug, title: path.title },
      phase: current.phase,
      step: {
        slug: step.slug,
        order: step.order,
        title: step.title,
        durationMinutes: step.durationMinutes,
        heading: step.heading,
        lead: step.lead,
        content: step.content,
      },
      position: { index: index + 1, total: steps.length },
      previous: neighbour(steps[index - 1]),
      next: neighbour(steps[index + 1]),
      mine: userId
        ? {
            isDone: mine?.completedAt != null,
            completedAt: mine?.completedAt ?? null,
            checks: (mine?.checks ?? {}) as Record<string, boolean>,
            note: mine?.note ?? null,
          }
        : null,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Writing (the signed-in user's own progress)                              */
  /* ------------------------------------------------------------------------ */

  async start(userId: string, slug: string) {
    const path = await this.requirePath(slug);
    await this.prisma.userPathProgress.upsert({
      where: { userId_pathId: { userId, pathId: path.id } },
      create: { userId, pathId: path.id },
      update: {},
    });
    return (await this.getBySlug(slug, userId)).progress;
  }

  /**
   * Saves what the user did at a step: done or not, checklist ticks, a note.
   * Anything not sent stays as it was. Starting work on a step also starts the path.
   */
  async saveStepProgress(
    userId: string,
    slug: string,
    stepSlug: string,
    input: StepProgressInput,
  ) {
    const path = await this.prisma.learningPath.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!path) throw new NotFoundException('Không tìm thấy lộ trình này.');
    const step = await this.prisma.learningStep.findUnique({
      where: { pathId_slug: { pathId: path.id, slug: stepSlug } },
    });
    if (!step) throw new NotFoundException('Không tìm thấy bước này.');

    if (input.checks) {
      const valid = new Set(collectCheckIds(step.content));
      const unknown = Object.keys(input.checks).filter((id) => !valid.has(id));
      if (unknown.length > 0) {
        throw new BadRequestException(
          `Mục checklist không có trong bước này: ${unknown.join(', ')}`,
        );
      }
    }

    const existing = await this.prisma.userStepProgress.findUnique({
      where: { userId_stepId: { userId, stepId: step.id } },
    });
    const checks = {
      ...((existing?.checks ?? {}) as Record<string, boolean>),
      ...input.checks,
    };
    const note =
      input.note === undefined ? existing?.note : input.note?.trim() || null;
    const completedAt =
      input.isDone === undefined
        ? existing?.completedAt
        : input.isDone
          ? (existing?.completedAt ?? new Date())
          : null;

    await this.prisma.$transaction([
      this.prisma.userStepProgress.upsert({
        where: { userId_stepId: { userId, stepId: step.id } },
        create: { userId, stepId: step.id, checks, note, completedAt },
        update: { checks, note, completedAt },
      }),
      this.prisma.userPathProgress.upsert({
        where: { userId_pathId: { userId, pathId: path.id } },
        create: { userId, pathId: path.id, lastStepId: step.id },
        update: { lastStepId: step.id },
      }),
    ]);
    const [stepState, overview] = await Promise.all([
      this.getStep(slug, stepSlug, userId),
      this.getBySlug(slug, userId),
    ]);
    return { mine: stepState.mine, progress: overview.progress };
  }

  /** Paths a user has begun, with where they are, for their profile. */
  async myPaths(userId: string) {
    const started = await this.prisma.userPathProgress.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { pathId: true },
    });
    const ids = started.map((row) => row.pathId);
    const all = await this.list({}, userId);
    const bySlug = new Map(all.map((path) => [path.slug, path]));
    const paths = await this.prisma.learningPath.findMany({
      where: { id: { in: ids }, status: 'PUBLISHED' },
      select: { id: true, slug: true },
    });
    const order = new Map(ids.map((id, index) => [id, index]));
    return paths
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .flatMap((path) => {
        const found = bySlug.get(path.slug);
        return found ? [found] : [];
      });
  }
}
