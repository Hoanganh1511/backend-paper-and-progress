import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { parse } from '../../shared/pipes/zod-parse.js';
import {
  calendarQuerySchema,
  dayParamSchema,
  LearningActivityService,
} from './learning-activity.service.js';

type AuthedRequest = { user: { sub: string } };

/** Reads only: the signed-in user sees their own days and nobody else's. */
@Controller('api/v1/learning-activity')
@UseGuards(JwtAuthGuard)
export class LearningActivityController {
  constructor(private service: LearningActivityService) {}

  @Get('calendar')
  calendar(@Req() req: AuthedRequest, @Query() query: unknown) {
    return this.service.getCalendar(
      req.user.sub,
      parse(calendarQuerySchema, query),
    );
  }

  @Get('days/:date')
  day(@Req() req: AuthedRequest, @Param('date') date: string) {
    return this.service.getDay(req.user.sub, parse(dayParamSchema, date));
  }
}
