// Seed riêng cho module project-dashboard (không ảnh hưởng prisma/seed.ts)
//   node --experimental-strip-types prisma/seed-dashboard.ts          # bỏ qua nếu đã có dữ liệu
//   node --experimental-strip-types prisma/seed-dashboard.ts --reset  # xoá dữ liệu dashboard rồi seed lại
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Status = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

interface Seed {
  title: string;
  status: Status;
  priority?: Priority;
  /** số ngày so với hôm nay: âm = quá hạn */
  due?: number;
  review?: boolean;
  discuss?: boolean;
  notes?: string;
  evidence?: string;
}

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

const categories: {
  name: string;
  icon: string;
  description: string;
  criteria: Seed[];
}[] = [
  {
    name: 'Frontend (Next.js)',
    icon: 'monitor',
    description: 'UI, responsive, routing, state management...',
    criteria: [
      {
        title: 'Trang đăng nhập / đăng ký',
        status: 'COMPLETED',
        priority: 'HIGH',
      },
      {
        title: 'Trang chủ responsive',
        status: 'COMPLETED',
        priority: 'MEDIUM',
      },
      {
        title: 'Form bật 2FA (QR + recovery codes)',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        due: 3,
      },
      {
        title: 'Trang quản lý hồ sơ cá nhân',
        status: 'IN_PROGRESS',
        due: -2,
        review: true,
      },
      { title: 'Dark mode', status: 'NOT_STARTED', priority: 'LOW' },
      { title: 'Tối ưu LCP / lazy load ảnh', status: 'NOT_STARTED', due: 14 },
      {
        title: 'Trang admin dashboard',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        discuss: true,
        due: 7,
      },
    ],
  },
  {
    name: 'Backend (NestJS)',
    icon: 'server',
    description: 'API, business logic, validation...',
    criteria: [
      { title: 'REST API người dùng', status: 'COMPLETED', priority: 'HIGH' },
      { title: 'Validation DTO toàn bộ endpoint', status: 'COMPLETED' },
      {
        title: 'Swagger docs đầy đủ request/response',
        status: 'IN_PROGRESS',
        due: -5,
      },
      {
        title: 'Module project-dashboard',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        due: 2,
      },
      {
        title: 'Upload ảnh lên S3',
        status: 'BLOCKED',
        priority: 'MEDIUM',
        notes: 'Chờ cấp IAM role cho bucket',
        due: -3,
      },
      {
        title: 'Gửi email thông báo bảo mật (SES)',
        status: 'NOT_STARTED',
        review: true,
      },
      {
        title: 'Logging có cấu trúc (pino)',
        status: 'NOT_STARTED',
        priority: 'LOW',
      },
      {
        title: 'Rate limiting toàn cục',
        status: 'NOT_STARTED',
        priority: 'HIGH',
        due: 5,
        discuss: true,
      },
    ],
  },
  {
    name: 'Database (PostgreSQL)',
    icon: 'database',
    description: 'Schema, migration, indexing...',
    criteria: [
      {
        title: 'Thiết kế schema User/Account/Profile',
        status: 'COMPLETED',
        priority: 'HIGH',
      },
      { title: 'Migration LoginHistory', status: 'COMPLETED' },
      { title: 'Migration TOTP + recovery codes', status: 'COMPLETED' },
      {
        title: 'Index cho truy vấn security events',
        status: 'IN_PROGRESS',
        due: 4,
      },
      {
        title: 'Backup tự động hằng ngày',
        status: 'NOT_STARTED',
        priority: 'HIGH',
        due: -7,
        review: true,
      },
      { title: 'Seed dữ liệu demo', status: 'IN_PROGRESS', priority: 'LOW' },
    ],
  },
  {
    name: 'Authentication & Security',
    icon: 'shield',
    description: 'Login, JWT, RBAC, rate limiting...',
    criteria: [
      {
        title: 'JWT access + refresh token rotation',
        status: 'COMPLETED',
        priority: 'HIGH',
        evidence: 'https://github.com/example/paper-and-progress/pull/12',
      },
      { title: 'Đăng nhập Google / Facebook / GitHub', status: 'COMPLETED' },
      { title: 'reCAPTCHA v3 cho register/login', status: 'COMPLETED' },
      { title: 'Chặn mật khẩu bị lộ (HaveIBeenPwned)', status: 'COMPLETED' },
      { title: 'Cảnh báo đăng nhập từ IP lạ', status: 'COMPLETED' },
      {
        title: 'TOTP 2FA + recovery codes',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        due: 1,
      },
      {
        title: 'RBAC cho khu vực admin',
        status: 'COMPLETED',
        priority: 'HIGH',
      },
      {
        title: 'Throttle brute-force /login/totp',
        status: 'BLOCKED',
        priority: 'HIGH',
        due: -1,
        notes: 'Cần quyết định dùng Redis hay in-memory',
        discuss: true,
      },
      {
        title: 'Thu hồi refresh token khi tắt 2FA',
        status: 'NOT_STARTED',
        review: true,
      },
    ],
  },
  {
    name: 'DevOps',
    icon: 'cloud',
    description: 'Docker, CI/CD, deployment...',
    criteria: [
      { title: 'docker-compose cho Postgres + Redis', status: 'COMPLETED' },
      {
        title: 'Dockerfile production (multi-stage)',
        status: 'IN_PROGRESS',
        due: 6,
      },
      {
        title: 'GitHub Actions: lint + test',
        status: 'NOT_STARTED',
        priority: 'HIGH',
        due: -4,
      },
      {
        title: 'Deploy staging',
        status: 'BLOCKED',
        notes: 'Chưa có server staging',
        due: 10,
      },
      {
        title: 'Giám sát uptime / health check',
        status: 'NOT_STARTED',
        priority: 'LOW',
      },
    ],
  },
  {
    name: 'Testing',
    icon: 'check-circle',
    description: 'Unit test, e2e, coverage...',
    criteria: [
      {
        title: 'Unit test AuthService',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        due: 3,
      },
      {
        title: 'Unit test TotpService (replay, recovery)',
        status: 'NOT_STARTED',
        priority: 'HIGH',
        review: true,
      },
      { title: 'E2E: login 2 bước với 2FA', status: 'NOT_STARTED', due: -2 },
      { title: 'E2E: admin endpoints chặn user thường', status: 'NOT_STARTED' },
      {
        title: 'Coverage >= 70%',
        status: 'NOT_STARTED',
        priority: 'LOW',
        due: 30,
      },
      {
        title: 'Smoke test sau deploy',
        status: 'NOT_STARTED',
        priority: 'LOW',
      },
    ],
  },
  {
    name: 'UI/UX Design',
    icon: 'palette',
    description: 'Design system, components, accessibility...',
    criteria: [
      { title: 'Bảng màu & typography', status: 'COMPLETED' },
      {
        title: 'Thư viện component (button, input, modal)',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        due: 8,
      },
      {
        title: 'Audit accessibility (WCAG AA)',
        status: 'NOT_STARTED',
        priority: 'HIGH',
        review: true,
        due: -1,
      },
      {
        title: 'Thiết kế màn hình quản trị',
        status: 'IN_PROGRESS',
        discuss: true,
      },
      {
        title: 'Empty / error / loading states',
        status: 'NOT_STARTED',
        priority: 'LOW',
      },
    ],
  },
  {
    name: 'Content & Media',
    icon: 'file-text',
    description: 'Content pages, video, DRM...',
    criteria: [
      {
        title: 'Trang giới thiệu & điều khoản',
        status: 'COMPLETED',
        priority: 'LOW',
      },
      {
        title: 'Trình phát video bài giảng',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        due: 12,
      },
      {
        title: 'Bảo vệ nội dung (DRM / signed URL)',
        status: 'BLOCKED',
        notes: 'Chờ chọn nhà cung cấp',
        discuss: true,
        due: -6,
      },
      { title: 'Hệ thống quản lý bài viết', status: 'NOT_STARTED' },
      {
        title: 'Tối ưu ảnh bìa (WebP)',
        status: 'NOT_STARTED',
        priority: 'LOW',
      },
    ],
  },
];

async function main() {
  const existing = await prisma.criteriaCategory.count();
  if (existing > 0) {
    if (!process.argv.includes('--reset')) {
      console.log(
        `Đã có ${existing} category, bỏ qua seed. Dùng --reset để xoá và seed lại.`,
      );
      return;
    }
    await prisma.projectActivity.deleteMany();
    await prisma.criteriaCategory.deleteMany(); // cascade xoá criteria
    await prisma.projectConfig.deleteMany();
  }

  await prisma.projectConfig.create({
    data: {
      name: 'Paper & Progress',
      description: 'Nền tảng học tập: theo dõi tiến độ phát triển dự án',
      health: 'ON_TRACK',
    },
  });

  const created: {
    id: string;
    title: string;
    categoryId: string;
    status: Status;
  }[] = [];

  for (const [i, cat] of categories.entries()) {
    const category = await prisma.criteriaCategory.create({
      data: {
        name: cat.name,
        icon: cat.icon,
        description: cat.description,
        sortOrder: i,
      },
    });
    for (const [j, c] of cat.criteria.entries()) {
      const row = await prisma.projectCriteria.create({
        data: {
          categoryId: category.id,
          title: c.title,
          status: c.status,
          priority: c.priority ?? 'MEDIUM',
          deadline: c.due === undefined ? null : daysFromNow(c.due),
          needsReview: c.review ?? false,
          needsDiscussion: c.discuss ?? false,
          notes: c.notes,
          evidenceUrl: c.evidence,
          completedAt: c.status === 'COMPLETED' ? daysFromNow(-(j + 1)) : null,
          sortOrder: j,
        },
      });
      created.push({
        id: row.id,
        title: row.title,
        categoryId: category.id,
        status: c.status,
      });
    }
  }

  // Activity mẫu, mới nhất trước
  const find = (title: string) => created.find((c) => c.title.includes(title))!;
  const totp = find('TOTP 2FA + recovery');
  const throttle = find('Throttle brute-force');
  const s3 = find('Upload ảnh lên S3');
  const rbac = find('RBAC cho khu vực admin');
  const swagger = find('Swagger docs');
  const dash = find('Module project-dashboard');
  const drm = find('DRM');
  const ga = find('GitHub Actions');
  const hibp = find('HaveIBeenPwned');
  const ip = find('IP lạ');
  const first = await prisma.criteriaCategory.findFirstOrThrow({
    orderBy: { sortOrder: 'asc' },
  });

  const activities = [
    {
      h: 1,
      type: 'STATUS_CHANGED',
      c: totp,
      title: `Bắt đầu thực hiện: ${totp.title}`,
      old: 'NOT_STARTED',
      new: 'IN_PROGRESS',
    },
    {
      h: 3,
      type: 'STATUS_CHANGED',
      c: throttle,
      title: `Bị chặn: ${throttle.title}`,
      old: 'IN_PROGRESS',
      new: 'BLOCKED',
    },
    {
      h: 5,
      type: 'CRITERIA_UPDATED',
      c: throttle,
      title: `Cần thảo luận: ${throttle.title}`,
    },
    {
      h: 8,
      type: 'STATUS_CHANGED',
      c: rbac,
      title: `Hoàn thành: ${rbac.title}`,
      old: 'IN_PROGRESS',
      new: 'COMPLETED',
    },
    {
      h: 12,
      type: 'NOTE_ADDED',
      c: s3,
      title: `Cập nhật ghi chú: ${s3.title}`,
    },
    {
      h: 20,
      type: 'STATUS_CHANGED',
      c: s3,
      title: `Bị chặn: ${s3.title}`,
      old: 'IN_PROGRESS',
      new: 'BLOCKED',
    },
    {
      h: 26,
      type: 'CRITERIA_CREATED',
      c: dash,
      title: `Tạo mới: ${dash.title}`,
    },
    {
      h: 30,
      type: 'CRITERIA_UPDATED',
      c: swagger,
      title: `Đánh dấu cần review: ${swagger.title}`,
    },
    {
      h: 48,
      type: 'STATUS_CHANGED',
      c: hibp,
      title: `Hoàn thành: ${hibp.title}`,
      old: 'IN_PROGRESS',
      new: 'COMPLETED',
    },
    {
      h: 52,
      type: 'STATUS_CHANGED',
      c: ip,
      title: `Hoàn thành: ${ip.title}`,
      old: 'IN_PROGRESS',
      new: 'COMPLETED',
    },
    {
      h: 72,
      type: 'NOTE_ADDED',
      c: drm,
      title: `Cập nhật ghi chú: ${drm.title}`,
    },
    {
      h: 96,
      type: 'STATUS_CHANGED',
      c: ga,
      title: `Đặt lại: ${ga.title}`,
      old: 'IN_PROGRESS',
      new: 'NOT_STARTED',
    },
    {
      h: 120,
      type: 'CATEGORY_CREATED',
      c: null,
      title: `Tạo danh mục: ${first.name}`,
    },
  ] as const;

  await prisma.projectActivity.createMany({
    data: activities.map((a) => ({
      type: a.type,
      title: a.title,
      criteriaId: a.c?.id ?? null,
      categoryId: a.c?.categoryId ?? first.id,
      description: 'old' in a ? `${a.old} → ${a.new}` : null,
      oldValue: 'old' in a ? a.old : null,
      newValue: 'new' in a ? a.new : null,
      createdAt: new Date(Date.now() - a.h * 60 * 60 * 1000),
    })),
  });

  console.log(
    `Seeded ${categories.length} categories, ${created.length} criteria, ${activities.length} activities`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
