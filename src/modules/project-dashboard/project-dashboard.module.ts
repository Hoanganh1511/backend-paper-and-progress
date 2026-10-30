import { Module } from '@nestjs/common';
import { ActivityController } from './controllers/activity.controller.js';
import { CategoryController } from './controllers/category.controller.js';
import { CriteriaController } from './controllers/criteria.controller.js';
import { DashboardController } from './controllers/dashboard.controller.js';
import { ProjectConfigController } from './controllers/project-config.controller.js';
import { ActivityService } from './services/activity.service.js';
import { CategoryService } from './services/category.service.js';
import { CriteriaService } from './services/criteria.service.js';
import { DashboardService } from './services/dashboard.service.js';

@Module({
  controllers: [
    DashboardController,
    ProjectConfigController,
    CategoryController,
    CriteriaController,
    ActivityController,
  ],
  providers: [
    ActivityService,
    CategoryService,
    CriteriaService,
    DashboardService,
  ],
})
export class ProjectDashboardModule {}
