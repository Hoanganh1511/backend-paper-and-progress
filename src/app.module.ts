import { Module } from '@nestjs/common';
import { AppConfigModule } from './shared/config/config.module.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { HealthModule } from './shared/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DevTodoModule } from './modules/dev-todo/dev-todo.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { SecurityEventModule } from './modules/admin/security-event.module.js';
import { ProjectDashboardModule } from './modules/project-dashboard/project-dashboard.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { TodosModule } from './modules/todos/todos.module.js';
import { DailyGateModule } from './modules/daily-gate/daily-gate.module.js';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    HealthModule,
    AuthModule,
    DevTodoModule,
    UsersModule,
    SecurityEventModule,
    AdminModule,
    ProjectDashboardModule,
    TodosModule,
    DailyGateModule,
  ],
})
export class AppModule {}
/*
Backend NestJS: localhost:8000
Frontend: localhost:3000
PostgreSQL: localhost:5432
Redis: localhost:6379

*/
