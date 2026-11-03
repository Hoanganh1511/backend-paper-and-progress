import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, VocabularyWord } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service.js';
import {
  CONTENT_CATEGORIES,
  categoryState,
  type CategoryState,
  type ContentCategory,
} from './vocabulary-content.schema.js';
import {
  VOCAB_SECTIONS,
  type CreateVocabularyDto,
  type ListVocabularyQuery,
  type UpdateVocabularyDto,
} from './vocabulary-admin.schema.js';

type Item = Record<string, unknown>;

const asItems = (value: unknown): Item[] =>
  Array.isArray(value) ? (value as Item[]) : [];

/** How many items each category has, and whether it is empty, in progress or complete. */
function categorySummary(word: VocabularyWord) {
  const summary = {} as Record<
    ContentCategory,
    { count: number; state: CategoryState }
  >;
  for (const category of CONTENT_CATEGORIES) {
    const items = asItems(word[category]);
    summary[category] = {
      count: items.length,
      state: categoryState(category, items),
    };
  }
  return summary;
}

/** Everything the editor needs of a word; seeded words without the new fields read as empty. */
function toDetail(word: VocabularyWord & { unit: { topic: string } }) {
  const content = {} as Record<ContentCategory, Item[]>;
  for (const category of CONTENT_CATEGORIES) {
    content[category] = asItems(word[category]);
  }
  return {
    id: word.id,
    unitId: word.unitId,
    unitTopic: word.unit.topic,
    section: word.section,
    word: word.word,
    pronunciation: word.pronunciation ?? '',
    partsOfSpeech: word.partsOfSpeech,
    level: word.level,
    topics: word.topics,
    meaning: word.meaning,
    meaningVi: word.meaningVi ?? '',
    example: word.example ?? '',
    contrast: word.contrast ?? '',
    forms: word.forms ?? '',
    pattern: word.pattern ?? '',
    updatedAt: word.updatedAt.toISOString(),
    ...content,
    categories: categorySummary(word),
  };
}

const withUnit = {
  unit: { select: { id: true, unitNumber: true, topic: true } },
};

/** The words of Daily English, written and edited by admins. */
@Injectable()
export class VocabularyAdminService {
  constructor(private prisma: PrismaService) {}

  /** What the form offers to pick from. */
  async meta() {
    const units = await this.prisma.vocabularyUnit.findMany({
      orderBy: { unitNumber: 'asc' },
      select: { id: true, unitNumber: true, topic: true },
    });
    return { units, sections: [...VOCAB_SECTIONS] };
  }

  async list({ q, unitId, level, section, page, limit }: ListVocabularyQuery) {
    const where: Prisma.VocabularyWordWhereInput = {
      ...(unitId && { unitId }),
      ...(level && { level }),
      ...(section && { section }),
      ...(q && {
        OR: [
          { word: { contains: q, mode: 'insensitive' } },
          { meaning: { contains: q, mode: 'insensitive' } },
          { meaningVi: { contains: q, mode: 'insensitive' } },
        ],
      }),
    };
    const [total, rows] = await Promise.all([
      this.prisma.vocabularyWord.count({ where }),
      this.prisma.vocabularyWord.findMany({
        where,
        include: withUnit,
        orderBy: [{ unitId: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      total,
      page,
      limit,
      items: rows.map((row) => ({
        id: row.id,
        word: row.word,
        meaning: row.meaning,
        meaningVi: row.meaningVi ?? '',
        level: row.level,
        partsOfSpeech: row.partsOfSpeech,
        section: row.section,
        unit: row.unit,
        categories: categorySummary(row),
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }

  async get(id: number) {
    const word = await this.prisma.vocabularyWord.findUnique({
      where: { id },
      include: { unit: true },
    });
    if (!word) throw new NotFoundException('Không tìm thấy từ này.');
    return toDetail(word);
  }

  async create(dto: CreateVocabularyDto) {
    await this.assertUnit(dto.unitId);
    await this.assertNotTaken(dto.unitId, dto.word);
    const created = await this.prisma.vocabularyWord.create({
      data: this.toData(dto) as Prisma.VocabularyWordUncheckedCreateInput,
    });
    return this.get(created.id);
  }

  async update(id: number, dto: UpdateVocabularyDto) {
    const existing = await this.prisma.vocabularyWord.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy từ này.');
    const unitId = dto.unitId ?? existing.unitId;
    if (dto.unitId !== undefined) await this.assertUnit(dto.unitId);
    if (dto.word !== undefined || dto.unitId !== undefined) {
      await this.assertNotTaken(unitId, dto.word ?? existing.word, id);
    }
    await this.prisma.vocabularyWord.update({
      where: { id },
      data: this.toData(dto),
    });
    return this.get(id);
  }

  /** Deleting a word also removes what learners wrote and marked for it. */
  async remove(id: number) {
    const existing = await this.prisma.vocabularyWord.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy từ này.');
    await this.prisma.vocabularyWord.delete({ where: { id } });
    return { deleted: true as const };
  }

  /* ------------------------------------------------------------------------ */

  /** The body as Prisma data; only what was sent is changed. */
  private toData(dto: UpdateVocabularyDto) {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) data[key] = value;
    }
    // "" clears an optional text; the learner-facing fields are nullable.
    for (const key of [
      'pronunciation',
      'meaningVi',
      'example',
      'contrast',
      'forms',
      'pattern',
    ]) {
      if (data[key] === '') data[key] = null;
    }
    return data as Prisma.VocabularyWordUncheckedUpdateInput;
  }

  private async assertUnit(unitId: number) {
    const unit = await this.prisma.vocabularyUnit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });
    if (!unit) throw new BadRequestException('Unit này không tồn tại.');
  }

  /** One word once per unit, so the lesson does not show it twice. */
  private async assertNotTaken(
    unitId: number,
    word: string,
    exceptId?: number,
  ) {
    const taken = await this.prisma.vocabularyWord.findFirst({
      where: {
        unitId,
        word: { equals: word.trim(), mode: 'insensitive' },
        ...(exceptId && { NOT: { id: exceptId } }),
      },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException(`Unit này đã có từ “${word.trim()}”.`);
    }
  }
}
