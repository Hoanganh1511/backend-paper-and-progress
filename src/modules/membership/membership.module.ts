import { Module } from '@nestjs/common';
import { MembershipController } from './membership.controller.js';
import { MembershipEventsService } from './membership-events.service.js';
import { MembershipOrdersService } from './membership-orders.service.js';
import { MembershipService } from './membership.service.js';

@Module({
  controllers: [MembershipController],
  providers: [
    MembershipService,
    MembershipOrdersService,
    MembershipEventsService,
  ],
  exports: [MembershipService],
})
export class MembershipModule {}
