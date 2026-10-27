import { Module } from '@nestjs/common';
import { AppConfigModule } from './shared/config/config.module.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { HealthModule } from './shared/health/health.module.js';
import { IamModule } from './modules/iam/iam.module.js';

@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule, IamModule],
})
export class AppModule {}
/*
Backend NestJS: localhost:8000
Keycloak: localhost:8080
Frontend: localhost:3000
PostgreSQL: localhost:5432
Redis: localhost:6379

*/
