import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import type { ActivityType, ListActivitiesDto } from '../dto/query.dto.js';

export interface ActivityInput {
  type: ActivityType;
  title: string;
  criteriaId?: string | null;
  categoryId?: string | null;
  description?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}

const withCriteria = {
  criteria: { select: { id: true, title: true, categoryId: true } },
} satisfies Prisma.ProjectActivityInclude;

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  // Nhận tx để activity được ghi cùng transaction với thay đổi gốc
  async log(input: ActivityInput, db: Prisma.TransactionClient = this.prisma) {
    return db.projectActivity.create({ data: input });
  }

  async list({ page, limit, type, criteriaId }: ListActivitiesDto) {
    const where: Prisma.ProjectActivityWhereInput = {
      ...(type && { type }),
      ...(criteriaId && { criteriaId }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.projectActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: withCriteria,
      }),
      this.prisma.projectActivity.count({ where }),
    ]);
    return { items: await this.withCategoryNames(rows), total, page, limit };
  }

  async recent(limit: number) {
    const rows = await this.prisma.projectActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: withCriteria,
    });
    return this.withCategoryNames(rows);
  }

  // categoryName lấy từ criteria.categoryId, hoặc activity.categoryId
  // (criteria/category đã xoá thì không còn tên -> null)
  private async withCategoryNames<
    T extends {
      categoryId: string | null;
      criteria: { categoryId: string } | null;
    },
  >(rows: T[]) {
    const ids = [
      ...new Set(
        rows
          .map((r) => r.criteria?.categoryId ?? r.categoryId)
          .filter((id): id is string => !!id),
      ),
    ];
    const categories = ids.length
      ? await this.prisma.criteriaCategory.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const names = new Map(categories.map((c) => [c.id, c.name]));

    return rows.map((r) => {
      const categoryId = r.criteria?.categoryId ?? r.categoryId;
      return {
        ...r,
        categoryName: (categoryId && names.get(categoryId)) || null,
      };
    });
  }
}
