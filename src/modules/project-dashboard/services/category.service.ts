import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CriteriaStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { ActivityService } from './activity.service.js';
import type { CreateCategoryDto } from '../dto/create-category.dto.js';
import type { UpdateCategoryDto } from '../dto/update-category.dto.js';
import type { ReorderDto } from '../dto/query.dto.js';

export const emptyStats = () => ({
  total: 0,
  completed: 0,
  inProgress: 0,
  notStarted: 0,
  blocked: 0,
});

const STATUS_KEY = {
  COMPLETED: 'completed',
  IN_PROGRESS: 'inProgress',
  NOT_STARTED: 'notStarted',
  BLOCKED: 'blocked',
} as const satisfies Record<
  CriteriaStatus,
  keyof ReturnType<typeof emptyStats>
>;

@Injectable()
export class CategoryService {
  constructor(
    private prisma: PrismaService,
    private activities: ActivityService,
  ) {}

  async list() {
    const [categories, grouped] = await Promise.all([
      this.prisma.criteriaCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.projectCriteria.groupBy({
        by: ['categoryId', 'status'],
        _count: { _all: true },
      }),
    ]);

    const stats = new Map<string, ReturnType<typeof emptyStats>>();
    for (const g of grouped) {
      const s = stats.get(g.categoryId) ?? emptyStats();
      s[STATUS_KEY[g.status]] += g._count._all;
      s.total += g._count._all;
      stats.set(g.categoryId, s);
    }

    return categories.map(({ id, name, description, icon, sortOrder }) => ({
      id,
      name,
      description,
      icon,
      sortOrder,
      stats: stats.get(id) ?? emptyStats(),
    }));
  }

  async get(id: string) {
    const category = await this.prisma.criteriaCategory.findUnique({
      where: { id },
      include: { criteria: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!category) throw new NotFoundException('Category không tồn tại');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    return this.prisma.$transaction(async (tx) => {
      const { _max } = await tx.criteriaCategory.aggregate({
        _max: { sortOrder: true },
      });
      const category = await tx.criteriaCategory.create({
        data: { ...dto, sortOrder: (_max.sortOrder ?? -1) + 1 },
      });
      await this.activities.log(
        {
          type: 'CATEGORY_CREATED',
          title: `Tạo danh mục: ${category.name}`,
          categoryId: category.id,
        },
        tx,
      );
      return category;
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.get(id);
    return this.prisma.criteriaCategory.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const category = await this.get(id);
    if (category.criteria.length > 0) {
      throw new BadRequestException(
        'Cannot delete category with existing criteria. Move or delete criteria first.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.criteriaCategory.delete({ where: { id } });
      await this.activities.log(
        {
          type: 'CATEGORY_DELETED',
          title: `Xóa danh mục: ${category.name}`,
          categoryId: id,
        },
        tx,
      );
    });
  }

  async reorder({ orders }: ReorderDto) {
    const ids = [...new Set(orders.map((o) => o.id))];
    const found = await this.prisma.criteriaCategory.count({
      where: { id: { in: ids } },
    });
    if (found !== ids.length) {
      throw new NotFoundException('Có category không tồn tại');
    }
    await this.prisma.$transaction(
      orders.map((o) =>
        this.prisma.criteriaCategory.update({
          where: { id: o.id },
          data: { sortOrder: o.sortOrder },
        }),
      ),
    );
    return this.list();
  }
}
