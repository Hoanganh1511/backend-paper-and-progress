import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service.js';
import type {
  CreateStepDto,
  SearchArticlesQuery,
  CreateStudyListDto,
  SectionDto,
  UpdateSectionDto,
  UpdateStepDto,
  UpdateStudyListDto,
} from './study-lists.schema.js';

const MAX_LISTS = 100;
const MAX_SECTIONS = 50;
const MAX_STEPS_PER_SECTION = 100;

/** What a step shows of the article it points to. */
const ARTICLE_SELECT = {
  id: true,
  slug: true,
  title: true,
  status: true,
  readingMinutes: true,
  publishedAt: true,
} as const;

// undefined = unchanged, ""/null = cleared
const toText = (value: string | null | undefined) =>
  value === undefined ? undefined : value || null;

/** How far a list is, from its steps; shared with the certificates that link to it. */
export function progressOfSections(
  sections: { steps: { isDone: boolean }[] }[],
) {
  const steps = sections.flatMap((section) => section.steps);
  const done = steps.filter((step) => step.isDone).length;
  return {
    stepCount: steps.length,
    doneStepCount: done,
    progress: steps.length ? Math.round((done / steps.length) * 100) : 0,
  };
}

// Every query carries userId: nobody reads or changes another user's lists.
@Injectable()
export class StudyListsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.studyList.findMany({
      where: { userId },
      include: {
        sections: { include: { steps: true } },
        certificates: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_LISTS,
    });
    return rows.map(({ sections, ...list }) => ({
      id: list.id,
      title: list.title,
      description: list.description,
      sectionCount: sections.length,
      certificates: list.certificates,
      ...progressOfSections(sections),
    }));
  }

  async get(userId: string, id: string) {
    const list = await this.prisma.studyList.findFirst({
      where: { id, userId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            steps: {
              orderBy: { order: 'asc' },
              include: { article: { select: ARTICLE_SELECT } },
            },
          },
        },
        certificates: { select: { id: true, name: true } },
      },
    });
    if (!list) throw new NotFoundException('Không tìm thấy danh sách học.');
    return {
      id: list.id,
      title: list.title,
      description: list.description,
      createdAt: list.createdAt.toISOString(),
      certificates: list.certificates,
      sectionCount: list.sections.length,
      ...progressOfSections(list.sections),
      sections: list.sections.map((section) => ({
        id: section.id,
        title: section.title,
        description: section.description,
        steps: section.steps.map((step) => ({
          id: step.id,
          title: step.title,
          note: step.note,
          url: step.url,
          isDone: step.isDone,
          doneAt: step.doneAt?.toISOString() ?? null,
          article: step.article ?? null,
        })),
      })),
    };
  }

  async create(userId: string, dto: CreateStudyListDto) {
    const count = await this.prisma.studyList.count({ where: { userId } });
    if (count >= MAX_LISTS) {
      throw new BadRequestException('Bạn đã có quá nhiều danh sách học.');
    }
    const created = await this.prisma.studyList.create({
      data: {
        userId,
        title: dto.title,
        description: toText(dto.description),
      },
    });
    return this.get(userId, created.id);
  }

  async update(userId: string, id: string, dto: UpdateStudyListDto) {
    await this.findOwned(userId, id);
    await this.prisma.studyList.update({
      where: { id },
      data: { title: dto.title, description: toText(dto.description) },
    });
    return this.get(userId, id);
  }

  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    // Certificates that pointed here keep everything else; the link just clears.
    await this.prisma.studyList.delete({ where: { id } });
    return { deleted: true as const };
  }

  /* ------------------------------------------------------------------------ */
  /* Sections                                                                 */
  /* ------------------------------------------------------------------------ */

  async addSection(userId: string, studyListId: string, dto: SectionDto) {
    await this.findOwned(userId, studyListId);
    const sections = await this.prisma.studySection.findMany({
      where: { studyListId },
      orderBy: { order: 'desc' },
    });
    if (sections.length >= MAX_SECTIONS) {
      throw new BadRequestException('Danh sách đã có quá nhiều phần.');
    }
    await this.prisma.studySection.create({
      data: {
        studyListId,
        order: (sections[0]?.order ?? 0) + 1,
        title: dto.title,
        description: toText(dto.description),
      },
    });
    return this.get(userId, studyListId);
  }

  async updateSection(
    userId: string,
    sectionId: string,
    dto: UpdateSectionDto,
  ) {
    const section = await this.findOwnedSection(userId, sectionId);
    await this.prisma.studySection.update({
      where: { id: sectionId },
      data: { title: dto.title, description: toText(dto.description) },
    });
    return this.get(userId, section.studyListId);
  }

  async removeSection(userId: string, sectionId: string) {
    const section = await this.findOwnedSection(userId, sectionId);
    await this.prisma.studySection.delete({ where: { id: sectionId } });
    return this.get(userId, section.studyListId);
  }

  async reorderSections(userId: string, studyListId: string, ids: string[]) {
    await this.findOwned(userId, studyListId);
    const sections = await this.prisma.studySection.findMany({
      where: { studyListId },
      select: { id: true },
    });
    this.assertSameIds(
      sections.map((section) => section.id),
      ids,
    );
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.studySection.update({
          where: { id },
          data: { order: index + 1 },
        }),
      ),
    );
    return this.get(userId, studyListId);
  }

  /* ------------------------------------------------------------------------ */
  /* Steps                                                                    */
  /* ------------------------------------------------------------------------ */

  async addStep(userId: string, sectionId: string, dto: CreateStepDto) {
    const section = await this.findOwnedSection(userId, sectionId);
    const steps = await this.prisma.studyStep.findMany({
      where: { sectionId },
      orderBy: { order: 'desc' },
    });
    if (steps.length >= MAX_STEPS_PER_SECTION) {
      throw new BadRequestException('Phần này đã có quá nhiều bước.');
    }
    // An article gives the step its title; a step written by hand has its own.
    const article = dto.articleId
      ? await this.findLinkableArticle(userId, dto.articleId)
      : null;
    await this.prisma.studyStep.create({
      data: {
        sectionId,
        order: (steps[0]?.order ?? 0) + 1,
        title: dto.title || (article?.title as string),
        note: toText(dto.note),
        url: toText(dto.url),
        articleId: article?.id ?? null,
      },
    });
    return this.get(userId, section.studyListId);
  }

  async updateStep(userId: string, stepId: string, dto: UpdateStepDto) {
    const step = await this.findOwnedStep(userId, stepId);
    // undefined leaves the link, ""/null unlinks, an id must be an article the user can use.
    let articleId: string | null | undefined;
    if (dto.articleId === undefined) articleId = undefined;
    else if (!dto.articleId) articleId = null;
    else articleId = (await this.findLinkableArticle(userId, dto.articleId)).id;
    await this.prisma.studyStep.update({
      where: { id: stepId },
      data: {
        title: dto.title,
        note: toText(dto.note),
        url: toText(dto.url),
        articleId,
        ...(dto.isDone !== undefined && dto.isDone !== step.isDone
          ? { isDone: dto.isDone, doneAt: dto.isDone ? new Date() : null }
          : {}),
      },
    });
    return this.get(userId, step.section.studyListId);
  }

  async removeStep(userId: string, stepId: string) {
    const step = await this.findOwnedStep(userId, stepId);
    await this.prisma.studyStep.delete({ where: { id: stepId } });
    return this.get(userId, step.section.studyListId);
  }

  async reorderSteps(userId: string, sectionId: string, ids: string[]) {
    const section = await this.findOwnedSection(userId, sectionId);
    const steps = await this.prisma.studyStep.findMany({
      where: { sectionId },
      select: { id: true },
    });
    this.assertSameIds(
      steps.map((step) => step.id),
      ids,
    );
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.studyStep.update({
          where: { id },
          data: { order: index + 1 },
        }),
      ),
    );
    return this.get(userId, section.studyListId);
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Articles a step can point to: the published ones, and the learner's own
   * drafts (so a lesson can be put in a list before it is published).
   */
  async searchArticles(userId: string, { q }: SearchArticlesQuery) {
    const rows = await this.prisma.article.findMany({
      where: {
        OR: [{ status: 'PUBLISHED' }, { authorId: userId }],
        ...(q && { title: { contains: q, mode: 'insensitive' } }),
      },
      select: ARTICLE_SELECT,
      orderBy: [{ updatedAt: 'desc' }],
      take: 20,
    });
    return rows;
  }

  private async findLinkableArticle(userId: string, articleId: string) {
    const article = await this.prisma.article.findFirst({
      where: {
        id: articleId,
        OR: [{ status: 'PUBLISHED' }, { authorId: userId }],
      },
      select: ARTICLE_SELECT,
    });
    if (!article) throw new BadRequestException('Bài viết không hợp lệ.');
    return article;
  }

  private async findOwned(userId: string, id: string) {
    const list = await this.prisma.studyList.findFirst({
      where: { id, userId },
    });
    if (!list) throw new NotFoundException('Không tìm thấy danh sách học.');
    return list;
  }

  private async findOwnedSection(userId: string, sectionId: string) {
    const section = await this.prisma.studySection.findFirst({
      where: { id: sectionId, studyList: { userId } },
    });
    if (!section) throw new NotFoundException('Không tìm thấy phần này.');
    return section;
  }

  private async findOwnedStep(userId: string, stepId: string) {
    const step = await this.prisma.studyStep.findFirst({
      where: { id: stepId, section: { studyList: { userId } } },
      include: { section: true },
    });
    if (!step) throw new NotFoundException('Không tìm thấy bước này.');
    return step;
  }

  private assertSameIds(existing: string[], given: string[]) {
    const same =
      existing.length === given.length &&
      new Set(given).size === given.length &&
      given.every((id) => existing.includes(id));
    if (!same) {
      throw new BadRequestException('Danh sách thứ tự không khớp.');
    }
  }
}
