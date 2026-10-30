import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { SubmitLearnDto } from '../dto/submit-learn.dto.js';
import { SubmitPracticeDto } from '../dto/submit-practice.dto.js';
import { SubmitTestDto } from '../dto/submit-test.dto.js';
import { DailyGateService } from '../services/daily-gate.service.js';

type AuthedRequest = { user: { sub: string } };

@Controller('api/v1/daily-gate')
@UseGuards(JwtAuthGuard)
export class DailyGateController {
  constructor(private dailyGate: DailyGateService) {}

  @Get('today')
  today(@Req() req: AuthedRequest) {
    return this.dailyGate.getToday(req.user.sub);
  }

  @Get('learn')
  learn(@Req() req: AuthedRequest) {
    return this.dailyGate.getLearn(req.user.sub);
  }

  @Post('learn/complete')
  @HttpCode(200)
  completeLearn(@Req() req: AuthedRequest, @Body() dto: SubmitLearnDto) {
    return this.dailyGate.completeLearn(req.user.sub, dto);
  }

  @Get('practice')
  practice(@Req() req: AuthedRequest) {
    return this.dailyGate.getPractice(req.user.sub);
  }

  @Post('practice/submit')
  @HttpCode(200)
  submitPractice(@Req() req: AuthedRequest, @Body() dto: SubmitPracticeDto) {
    return this.dailyGate.submitPractice(req.user.sub, dto);
  }

  @Get('test')
  test(@Req() req: AuthedRequest) {
    return this.dailyGate.getTest(req.user.sub);
  }

  @Post('test/submit')
  @HttpCode(200)
  submitTest(@Req() req: AuthedRequest, @Body() dto: SubmitTestDto) {
    return this.dailyGate.submitTest(req.user.sub, dto);
  }

  @Get('stats')
  stats(@Req() req: AuthedRequest) {
    return this.dailyGate.getStats(req.user.sub);
  }

  @Get('calendar')
  calendar(@Req() req: AuthedRequest) {
    return this.dailyGate.getCalendar(req.user.sub);
  }
}
