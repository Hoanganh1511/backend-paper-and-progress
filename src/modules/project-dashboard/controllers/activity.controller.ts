import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { ActivityService } from '../services/activity.service.js';
import { ListActivitiesDto, RecentActivitiesDto } from '../dto/query.dto.js';

@Controller('api/v1/project-dashboard/activities')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ActivityController {
  constructor(private activities: ActivityService) {}

  @Get()
  list(@Query() query: ListActivitiesDto) {
    return this.activities.list(query);
  }

  @Get('recent')
  recent(@Query() { limit }: RecentActivitiesDto) {
    return this.activities.recent(limit);
  }
}
