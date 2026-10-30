import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AdminService } from './admin.service.js';
import {
  ListLoginHistoryDto,
  ListSecurityEventsDto,
  ListUsersDto,
} from './dtos/admin-query.dto.js';

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('users')
  listUsers(@Query() query: ListUsersDto) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Get('login-history')
  listLoginHistory(@Query() query: ListLoginHistoryDto) {
    return this.adminService.listLoginHistory(query);
  }

  @Get('security-events')
  listSecurityEvents(@Query() query: ListSecurityEventsDto) {
    return this.adminService.listSecurityEvents(query);
  }

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }
}
