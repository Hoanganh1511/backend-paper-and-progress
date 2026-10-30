import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { DashboardService } from '../services/dashboard.service.js';
import { UpdateProjectConfigDto } from '../dto/query.dto.js';

@Controller('api/v1/project-dashboard/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ProjectConfigController {
  constructor(private dashboard: DashboardService) {}

  @Get()
  get() {
    return this.dashboard.getConfig();
  }

  @Patch()
  update(@Body() dto: UpdateProjectConfigDto) {
    return this.dashboard.updateConfig(dto);
  }
}
