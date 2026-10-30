import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service.js';
import type {
  ListLoginHistoryDto,
  ListSecurityEventsDto,
  ListUsersDto,
} from './dtos/admin-query.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);
const startOfDaysAgo = (n: number) => {
  const d = daysAgo(n);
  d.setHours(0, 0, 0, 0);
  return d;
};

const dateRange = (from?: string, to?: string) =>
  from || to
    ? {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      }
    : undefined;

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// "local" khi tài khoản có mật khẩu, cộng thêm mỗi social đã liên kết
const providersOf = (
  accounts: { provider: string }[],
  hasPassword: boolean,
) => [...(hasPassword ? ['local'] : []), ...accounts.map((a) => a.provider)];

const paginate = (page: number, limit: number) => ({
  skip: (page - 1) * limit,
  take: limit,
});

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async listUsers({ page, limit, search }: ListUsersDto) {
    const where: Prisma.UserWhereInput = search
      ? { email: { contains: search, mode: 'insensitive' } }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...paginate(page, limit),
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          isActive: true,
          createdAt: true,
          password: true,
          totp: { select: { enabled: true } },
          accounts: { select: { provider: true } },
          loginHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map(
        ({ totp, password, accounts, loginHistory, ...user }) => ({
          ...user,
          totpEnabled: totp?.enabled ?? false,
          providers: providersOf(accounts, password !== null),
          lastLoginAt: loginHistory[0]?.createdAt ?? null,
        }),
      ),
      total,
      page,
      limit,
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        password: true,
        totp: { select: { enabled: true, enabledAt: true } },
        accounts: { select: { provider: true } },
        loginHistory: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, ip: true, userAgent: true, createdAt: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User không tồn tại');

    const { totp, password, accounts, ...rest } = user;
    return {
      ...rest,
      providers: providersOf(accounts, password !== null),
      totpEnabled: totp?.enabled ?? false,
      totpEnabledAt: totp?.enabledAt ?? null,
    };
  }

  async listLoginHistory(q: ListLoginHistoryDto) {
    const where: Prisma.LoginHistoryWhereInput = {
      ...(q.userId && { userId: q.userId }),
      ...(q.ip && { ip: q.ip }),
      ...(q.search && {
        OR: [
          { ip: { contains: q.search } },
          { user: { email: { contains: q.search, mode: 'insensitive' } } },
        ],
      }),
      createdAt: dateRange(q.from, q.to),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.loginHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...paginate(q.page, q.limit),
        include: { user: { select: { id: true, email: true } } },
      }),
      this.prisma.loginHistory.count({ where }),
    ]);
    return {
      items: await this.markNewIps(items),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  async listSecurityEvents(q: ListSecurityEventsDto) {
    const where: Prisma.SecurityEventWhereInput = {
      ...(q.type && { type: q.type }),
      createdAt: dateRange(q.from, q.to),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.securityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...paginate(q.page, q.limit),
        include: { user: { select: { id: true, email: true } } },
      }),
      this.prisma.securityEvent.count({ where }),
    ]);
    return { items, total, page: q.page, limit: q.limit };
  }

  // IP "mới" = lần đầu user đăng nhập từ IP này, trong khi user đã từng đăng nhập từ trước.
  // Lần đăng nhập đầu tiên của một user không tính là IP lạ.
  private async markNewIps<
    T extends { id: string; userId: string; ip: string },
  >(items: T[]) {
    if (items.length === 0) return [];
    const userIds = [...new Set(items.map((i) => i.userId))];
    const [firstPerIp, firstPerUser] = await Promise.all([
      this.prisma.loginHistory.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: 'asc' },
        distinct: ['userId', 'ip'],
        select: { id: true },
      }),
      this.prisma.loginHistory.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: 'asc' },
        distinct: ['userId'],
        select: { id: true },
      }),
    ]);
    const firstIp = new Set(firstPerIp.map((r) => r.id));
    const firstLogin = new Set(firstPerUser.map((r) => r.id));
    return items.map((item) => ({
      ...item,
      isNewIp: firstIp.has(item.id) && !firstLogin.has(item.id),
    }));
  }

  async getStats() {
    const today = startOfToday();
    const week = daysAgo(7);

    const [
      totalUsers,
      newUsersToday,
      newUsersWeek,
      loginsToday,
      loginsWeek,
      totpEnabled,
      eventsByType,
      recentLogins,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.user.count({ where: { createdAt: { gte: week } } }),
      this.prisma.loginHistory.count({ where: { createdAt: { gte: today } } }),
      this.prisma.loginHistory.count({ where: { createdAt: { gte: week } } }),
      this.prisma.userTotp.count({ where: { enabled: true } }),
      this.prisma.securityEvent.groupBy({
        by: ['type'],
        where: { createdAt: { gte: week } },
        _count: { _all: true },
      }),
      this.prisma.loginHistory.findMany({
        where: { createdAt: { gte: startOfDaysAgo(6) } },
        select: { createdAt: true },
      }),
    ]);

    // 7 ngày gần nhất, kể cả ngày không có login
    const counts = new Map<string, number>();
    for (const { createdAt } of recentLogins) {
      counts.set(dayKey(createdAt), (counts.get(dayKey(createdAt)) ?? 0) + 1);
    }
    const loginsByDay = Array.from({ length: 7 }, (_, i) => {
      const date = dayKey(daysAgo(6 - i));
      return { date, count: counts.get(date) ?? 0 };
    });

    return {
      users: {
        total: totalUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersWeek,
      },
      logins: { today: loginsToday, thisWeek: loginsWeek },
      loginsByDay,
      twoFactor: {
        enabled: totpEnabled,
        disabled: totalUsers - totpEnabled,
      },
      securityEventsLast7Days: Object.fromEntries(
        eventsByType.map((e) => [e.type, e._count._all]),
      ),
    };
  }
}
