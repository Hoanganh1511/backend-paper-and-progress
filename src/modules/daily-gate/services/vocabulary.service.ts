import { Injectable } from '@nestjs/common';
import type { VocabSection } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service.js';

/** The order the sections are shown in. */
export const SECTION_ORDER: VocabSection[] = [
  'TOPIC_CONTRAST',
  'PHRASAL_VERB',
  'PHRASE_COLLOCATION',
  'WORD_PATTERN',
  'WORD_FORMATION',
];

@Injectable()
export class VocabularyService {
  constructor(private prisma: PrismaService) {}

  /** The words of the units, in a fixed order so seeded questions are repeatable. */
  wordsOfUnits(unitIds: number[]) {
    return this.prisma.vocabularyWord.findMany({
      where: { unitId: { in: unitIds } },
      orderBy: { id: 'asc' },
    });
  }

  countWords(unitIds: number[]) {
    return this.prisma.vocabularyWord.count({
      where: { unitId: { in: unitIds } },
    });
  }

  async unitsByIds(unitIds: number[]) {
    const units = await this.prisma.vocabularyUnit.findMany({
      where: { id: { in: unitIds } },
      orderBy: { unitNumber: 'asc' },
    });
    return units.map(({ id, unitNumber, topic }) => ({
      id,
      unitNumber,
      topic,
    }));
  }

  /** Words grouped by section, in the display order; empty sections are left out. */
  groupBySection<T extends { section: VocabSection }>(words: T[]) {
    return SECTION_ORDER.map((type) => ({
      type,
      words: words.filter((word) => word.section === type),
    })).filter((section) => section.words.length > 0);
  }
}
