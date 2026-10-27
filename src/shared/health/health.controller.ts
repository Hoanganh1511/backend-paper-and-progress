import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    const db = await this.prisma.$queryRaw`SELECT 1`
      .then(() => 'ok')
      .catch(() => 'fail');
    return {
      status: db === 'ok' ? 'healthy' : 'degraded',
      db,
      timestamp: new Date().toISOString(),
    };
  }
}
