import { Injectable } from '@nestjs/common';
import type { Prisma, ProjectCriteria } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { emptyStats } from './category.service.js';
import type {
  IssueType,
  ListIssuesDto,
  UpdateProjectConfigDto,
} from '../dto/query.dto.js';

const DEFAULT_PROJECT_NAME = 'Paper & Progress';

// Thứ tự ưu tiên khi sắp xếp: BLOCKED > OVERDUE > NEEDS_REVIEW > NEEDS_DISCUSSION
const PRIORITY: IssueType[] = [
  'BLOCKED',
  'OVERDUE',
  'NEEDS_REVIEW',
  'NEEDS_DISCUSSION',
];

const notCompleted = { status: { not: 'COMPLETED' } } as const;

// Điều kiện DB của từng loại issue (now tính ở thời điểm gọi)
const issueWhere = (
  type: IssueType,
  now: Date,
): Prisma.ProjectCriteriaWhereInput => {
  switch (type) {
    case 'BLOCKED':
      return { status: 'BLOCKED' };
    case 'OVERDUE':
      return { ...notCompleted, deadline: { lt: now } };
    case 'NEEDS_REVIEW':
      return { ...notCompleted, needsReview: true };
    case 'NEEDS_DISCUSSION':
      return { ...notCompleted, needsDiscussion: true };
  }
};

type CriteriaWithCategory = ProjectCriteria & { category: { name: string } };

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const now = new Date();
    const [project, grouped, overdue, needsAttention, needsDiscussion] =
      await Promise.all([
        this.getConfig(),
        this.prisma.projectCriteria.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.count('OVERDUE', now),
        this.count('NEEDS_REVIEW', now),
        this.count('NEEDS_DISCUSSION', now),
      ]);

    const statistics = emptyStats();
    for (const g of grouped) {
      const n = g._count._all;
      statistics.total += n;
      if (g.status === 'COMPLETED') statistics.completed = n;
      if (g.status === 'IN_PROGRESS') statistics.inProgress = n;
      if (g.status === 'NOT_STARTED') statistics.notStarted = n;
      if (g.status === 'BLOCKED') statistics.blocked = n;
    }

    // Top 3: không tính NEEDS_DISCUSSION ở card này
    const rows = await this.findIssues(
      ['BLOCKED', 'OVERDUE', 'NEEDS_REVIEW'],
      now,
    );
    const issues = rows
      .slice(0, 3)
      .map((r) => this.toIssue(r, now, ['BLOCKED', 'OVERDUE', 'NEEDS_REVIEW']));

    const { name, description, health, updatedAt } = project;
    return {
      project: { name, description, health, updatedAt },
      statistics,
      // Ba số này có thể trùng nhau (1 criteria vừa overdue vừa needsReview)
      outstanding: { overdue, needsAttention, needsDiscussion },
      issues,
    };
  }

  async listIssues({ type, page, limit }: ListIssuesDto) {
    const now = new Date();
    const types = type ? [type] : PRIORITY;
    // Lọc theo type nhưng issueTypes vẫn hiện đủ các loại criteria đang vướng
    const rows = await this.findIssues(types, now);
    const items = rows
      .slice((page - 1) * limit, page * limit)
      .map((r) => this.toIssue(r, now, PRIORITY));
    return { items, total: rows.length, page, limit };
  }

  async getConfig() {
    const existing = await this.prisma.projectConfig.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    return (
      existing ??
      this.prisma.projectConfig.create({ data: { name: DEFAULT_PROJECT_NAME } })
    );
  }

  async updateConfig(dto: UpdateProjectConfigDto) {
    const existing = await this.getConfig();
    return this.prisma.projectConfig.update({
      where: { id: existing.id },
      data: dto,
    });
  }

  private count(type: IssueType, now: Date) {
    return this.prisma.projectCriteria.count({ where: issueWhere(type, now) });
  }

  // Lấy mọi criteria khớp ít nhất 1 loại, sắp xếp theo mức ưu tiên cao nhất
  private async findIssues(types: IssueType[], now: Date) {
    const rows = await this.prisma.projectCriteria.findMany({
      where: { OR: types.map((t) => issueWhere(t, now)) },
      include: { category: { select: { name: true } } },
    });
    const rank = (r: CriteriaWithCategory) =>
      PRIORITY.findIndex((t) => this.typesOf(r, now).includes(t));
    return rows.sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (a.deadline?.getTime() ?? Infinity) -
          (b.deadline?.getTime() ?? Infinity),
    );
  }

  private typesOf(r: ProjectCriteria, now: Date): IssueType[] {
    const open = r.status !== 'COMPLETED';
    const types: IssueType[] = [];
    if (r.status === 'BLOCKED') types.push('BLOCKED');
    if (open && r.deadline && r.deadline < now) types.push('OVERDUE');
    if (open && r.needsReview) types.push('NEEDS_REVIEW');
    if (open && r.needsDiscussion) types.push('NEEDS_DISCUSSION');
    return types;
  }

  private toIssue(r: CriteriaWithCategory, now: Date, allowed: IssueType[]) {
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      categoryName: r.category.name,
      issueTypes: this.typesOf(r, now).filter((t) => allowed.includes(t)),
    };
  }
}
