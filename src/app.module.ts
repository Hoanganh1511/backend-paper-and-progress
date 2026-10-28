import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerExceptionFilter } from './shared/filters/throttler-exception.filter.js';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './shared/config/config.module.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { HealthModule } from './shared/health/health.module.js';
import { IamModule } from './modules/iam/iam.module.js';

@Module({
  imports: [
    AppConfigModule,
    // Global default: 60 requests / 60s per IP (ttl is in milliseconds)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    DatabaseModule,
    HealthModule,
    IamModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ThrottlerExceptionFilter },
  ],
})
export class AppModule {}
/*
Backend NestJS: localhost:8000
Keycloak: localhost:8080
Frontend: localhost:3000
PostgreSQL: localhost:5432
Redis: localhost:6379

*/
