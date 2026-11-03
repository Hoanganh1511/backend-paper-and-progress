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
import { LearningActivityModule } from './modules/learning-activity/learning-activity.module.js';
import { KnowledgeModule } from './modules/knowledge/knowledge.module.js';
import { LearningPathsModule } from './modules/learning-paths/learning-paths.module.js';
import { ArticlesModule } from './modules/articles/articles.module.js';
import { MembershipModule } from './modules/membership/membership.module.js';
import { CertificatesModule } from './modules/certificates/certificates.module.js';
import { StudyListsModule } from './modules/study-lists/study-lists.module.js';
import { VocabularyAdminModule } from './modules/vocabulary-admin/vocabulary-admin.module.js';
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
    ArticlesModule,
    MembershipModule,
    LearningActivityModule,
    KnowledgeModule,
    LearningPathsModule,
    CertificatesModule,
    StudyListsModule,
    VocabularyAdminModule,
  ],
})
export class AppModule {}
/*
Backend NestJS: localhost:8000
Frontend: localhost:3000
PostgreSQL: localhost:5432
Redis: localhost:6379

*/
