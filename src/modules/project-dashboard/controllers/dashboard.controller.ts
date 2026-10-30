import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { DashboardService } from '../services/dashboard.service.js';
import { ListIssuesDto } from '../dto/query.dto.js';

@Controller('api/v1/project-dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('stats')
  stats() {
    return this.dashboard.getStats();
  }

  @Get('issues')
  issues(@Query() query: ListIssuesDto) {
    return this.dashboard.listIssues(query);
  }
}
