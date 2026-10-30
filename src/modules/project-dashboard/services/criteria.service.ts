import { Injectable, NotFoundException } from '@nestjs/common';
import type { CriteriaStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { ActivityService } from './activity.service.js';
import type { CreateCriteriaDto } from '../dto/create-criteria.dto.js';
import type { UpdateCriteriaDto } from '../dto/update-criteria.dto.js';
import type { ListCriteriaDto, ReorderDto } from '../dto/query.dto.js';

const STATUS_TITLE: Record<CriteriaStatus, (title: string) => string> = {
  COMPLETED: (t) => `Hoàn thành: ${t}`,
  IN_PROGRESS: (t) => `Bắt đầu thực hiện: ${t}`,
  BLOCKED: (t) => `Bị chặn: ${t}`,
  NOT_STARTED: (t) => `Đặt lại: ${t}`,
};

const toDate = (value?: string | null) =>
  value === undefined ? undefined : value === null ? null : new Date(value);

@Injectable()
export class CriteriaService {
  constructor(
    private prisma: PrismaService,
    private activities: ActivityService,
  ) {}

  async list({ status, categoryId, search, page, limit }: ListCriteriaDto) {
    const where: Prisma.ProjectCriteriaWhereInput = {
      ...(status && { status }),
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { category: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.projectCriteria.findMany({
        where,
        orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { category: { select: { id: true, name: true, icon: true } } },
      }),
      this.prisma.projectCriteria.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async get(id: string) {
    const criteria = await this.prisma.projectCriteria.findUnique({
      where: { id },
      include: {
        category: true,
        activities: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!criteria) throw new NotFoundException('Criteria không tồn tại');
    return criteria;
  }

  async create(dto: CreateCriteriaDto) {
    await this.assertCategory(dto.categoryId);

    return this.prisma.$transaction(async (tx) => {
      const { _max } = await tx.projectCriteria.aggregate({
        where: { categoryId: dto.categoryId },
        _max: { sortOrder: true },
      });
      const criteria = await tx.projectCriteria.create({
        data: {
          ...dto,
          deadline: toDate(dto.deadline),
          sortOrder: (_max.sortOrder ?? -1) + 1,
          completedAt: dto.status === 'COMPLETED' ? new Date() : null,
        },
      });
      await this.activities.log(
        {
          type: 'CRITERIA_CREATED',
          title: `Tạo mới: ${criteria.title}`,
          criteriaId: criteria.id,
          categoryId: criteria.categoryId,
        },
        tx,
      );
      return criteria;
    });
  }

  async update(id: string, dto: UpdateCriteriaDto) {
    const existing = await this.get(id);
    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      await this.assertCategory(dto.categoryId);
    }

    const data: Prisma.ProjectCriteriaUncheckedUpdateInput = {
      ...dto,
      deadline: toDate(dto.deadline),
    };
    const statusChanged = !!dto.status && dto.status !== existing.status;
    if (statusChanged) {
      data.completedAt = dto.status === 'COMPLETED' ? new Date() : null;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectCriteria.update({ where: { id }, data });
      const base = { criteriaId: id, categoryId: updated.categoryId };
      const title = updated.title;

      if (statusChanged) {
        await this.activities.log(
          {
            ...base,
            type: 'STATUS_CHANGED',
            title: STATUS_TITLE[updated.status](title),
            description: `${existing.status} → ${updated.status}`,
            oldValue: existing.status,
            newValue: updated.status,
          },
          tx,
        );
      }
      if (
        dto.needsReview !== undefined &&
        dto.needsReview !== existing.needsReview
      ) {
        await this.activities.log(
          {
            ...base,
            type: 'CRITERIA_UPDATED',
            title: dto.needsReview
              ? `Đánh dấu cần review: ${title}`
              : `Bỏ đánh dấu review: ${title}`,
          },
          tx,
        );
      }
      if (
        dto.needsDiscussion !== undefined &&
        dto.needsDiscussion !== existing.needsDiscussion
      ) {
        await this.activities.log(
          {
            ...base,
            type: 'CRITERIA_UPDATED',
            title: dto.needsDiscussion
              ? `Cần thảo luận: ${title}`
              : `Đã giải quyết thảo luận: ${title}`,
          },
          tx,
        );
      }
      if (dto.notes !== undefined && dto.notes !== existing.notes) {
        await this.activities.log(
          {
            ...base,
            type: 'NOTE_ADDED',
            title: `Cập nhật ghi chú: ${title}`,
          },
          tx,
        );
      }
      return updated;
    });
  }

  async remove(id: string) {
    const criteria = await this.get(id);
    await this.prisma.$transaction(async (tx) => {
      // criteriaId tự về null khi xoá (onDelete: SetNull), categoryId giữ lại
      await this.activities.log(
        {
          type: 'CRITERIA_DELETED',
          title: `Xóa: ${criteria.title}`,
          criteriaId: id,
          categoryId: criteria.categoryId,
        },
        tx,
      );
      await tx.projectCriteria.delete({ where: { id } });
    });
  }

  async reorder({ orders }: ReorderDto) {
    const ids = [...new Set(orders.map((o) => o.id))];
    const found = await this.prisma.projectCriteria.count({
      where: { id: { in: ids } },
    });
    if (found !== ids.length) {
      throw new NotFoundException('Có criteria không tồn tại');
    }
    await this.prisma.$transaction(
      orders.map((o) =>
        this.prisma.projectCriteria.update({
          where: { id: o.id },
          data: { sortOrder: o.sortOrder },
        }),
      ),
    );
    return { updated: orders.length };
  }

  private async assertCategory(categoryId: string) {
    const exists = await this.prisma.criteriaCategory.count({
      where: { id: categoryId },
    });
    if (!exists) throw new NotFoundException('Category không tồn tại');
  }
}
