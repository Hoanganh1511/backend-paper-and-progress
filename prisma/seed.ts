import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const todos = [
  {
    title: 'Auth - Register/Login/Logout',
    status: 'done',
    priority: 'high',
    category: 'Auth',
  },
  {
    title: 'Auth - Refresh Token',
    status: 'done',
    priority: 'high',
    category: 'Auth',
  },
  {
    title: 'Auth - Forgot Password + Email',
    status: 'done',
    priority: 'high',
    category: 'Auth',
  },
  {
    title: 'Auth - Rate Limiting (Throttler)',
    status: 'done',
    priority: 'medium',
    category: 'Auth',
  },
  {
    title: 'Auth - Brute Force Detection',
    status: 'done',
    priority: 'medium',
    category: 'Auth',
  },
  {
    title: 'Auth - Token Rotation',
    status: 'done',
    priority: 'medium',
    category: 'Auth',
  },
  {
    title: 'Profile - Trang hồ sơ người dùng',
    status: 'pending',
    priority: 'high',
    category: 'Profile',
  },
  {
    title: 'Profile - Upload avatar (S3)',
    status: 'pending',
    priority: 'medium',
    category: 'Profile',
  },
  {
    title: 'Profile - Đổi mật khẩu',
    status: 'pending',
    priority: 'medium',
    category: 'Profile',
  },
  {
    title: 'Profile - Dark mode / Theme',
    status: 'pending',
    priority: 'low',
    category: 'UI/UX',
  },
];

async function main() {
  if ((await prisma.devTodo.count()) > 0) {
    console.log('DevTodo already seeded, skipping');
    return;
  }
  await prisma.devTodo.createMany({
    data: todos.map((t) => ({
      ...t,
      completedAt: t.status === 'done' ? new Date() : null,
    })),
  });
  console.log(`Seeded ${todos.length} dev todos`);
}

main().finally(() => prisma.$disconnect());
