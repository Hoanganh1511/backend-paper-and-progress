import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Sse,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
  type MessageEvent,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { verifyCassoSignature } from './casso-signature.js';
import { MembershipEventsService } from './membership-events.service.js';
import { MembershipOrdersService } from './membership-orders.service.js';
import { MembershipService } from './membership.service.js';

export class GrantMembershipDto {
  /** When the membership ends, as an ISO date; it has to be in the future. */
  @IsDateString()
  expiresAt: string;
}

export class CreateOrderDto {
  @IsEnum(['MONTH', 'YEAR'])
  plan: 'MONTH' | 'YEAR';
}

export class ListOrdersDto {
  @IsOptional()
  @IsEnum(['PENDING', 'PAID', 'CANCELLED'])
  status?: 'PENDING' | 'PAID' | 'CANCELLED';
}

@Controller('api/v1')
export class MembershipController {
  constructor(
    private membership: MembershipService,
    private orders: MembershipOrdersService,
    private events: MembershipEventsService,
  ) {}

  /** The signed-in reader's own membership. */
  @Get('membership/me')
  @UseGuards(JwtAuthGuard)
  mine(@Req() req: { user: { sub: string } }) {
    return this.membership.get(req.user.sub);
  }

  /** The plans and prices; `isOpen` is false until the owner has set prices and a bank account. */
  @Get('membership/plans')
  plans() {
    return this.orders.plans();
  }

  @Post('membership/orders')
  @UseGuards(JwtAuthGuard)
  createOrder(
    @Req() req: { user: { sub: string } },
    @Body() body: CreateOrderDto,
  ) {
    return this.orders.create(req.user.sub, body.plan);
  }

  @Get('membership/orders/me')
  @UseGuards(JwtAuthGuard)
  myOrders(@Req() req: { user: { sub: string } }) {
    return this.orders.listMine(req.user.sub);
  }

  @Post('membership/orders/:id/cancel')
  @UseGuards(JwtAuthGuard)
  cancelMine(@Req() req: { user: { sub: string } }, @Param('id') id: string) {
    return this.orders.cancelMine(req.user.sub, id);
  }

  /**
   * Casso (Webhook V2) calls this when money arrives in the bank account. It is
   * public, so the signature is what says the call is Casso's. A call with a
   * good signature always gets 200 and `success`, even when nothing matched,
   * or Casso would keep sending it again.
   */
  @Post('membership/casso-webhook')
  @HttpCode(200)
  async cassoWebhook(
    @Headers('x-casso-signature') signature: string | undefined,
    @Body() body: unknown,
  ) {
    const key = process.env.CASSO_CHECKSUM_KEY;
    if (!key) {
      throw new ServiceUnavailableException('Casso chưa được cấu hình.');
    }
    if (!verifyCassoSignature(signature, body, key)) {
      throw new UnauthorizedException('Chữ ký không hợp lệ.');
    }
    const data = (body as { data?: unknown } | null)?.data;
    const rows = Array.isArray(data) ? data : [data];
    const results: string[] = [];
    for (const row of rows) {
      results.push(await this.orders.handleCassoTransaction(row));
    }
    return { success: true, results };
  }

  /** Tells the signed-in reader's open page when their membership changes. */
  @Sse('membership/events')
  @UseGuards(JwtAuthGuard)
  stream(@Req() req: { user: { sub: string } }): Observable<MessageEvent> {
    return this.events.streamFor(req.user.sub);
  }

  @Get('admin/membership-orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  adminOrders(@Query() query: ListOrdersDto) {
    return this.orders.listForAdmin(query.status);
  }

  @Post('admin/membership-orders/:id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  confirmOrder(@Param('id') id: string) {
    return this.orders.confirm(id);
  }

  @Post('admin/membership-orders/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  cancelOrder(@Param('id') id: string) {
    return this.orders.cancel(id);
  }

  @Put('admin/users/:id/membership')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  grant(@Param('id') id: string, @Body() body: GrantMembershipDto) {
    return this.membership.grant(id, new Date(body.expiresAt), 'ADMIN');
  }

  @Delete('admin/users/:id/membership')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  revoke(@Param('id') id: string) {
    return this.membership.revoke(id);
  }
}
