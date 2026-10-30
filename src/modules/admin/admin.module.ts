import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { SecurityEventModule } from './security-event.module.js';

@Module({
  imports: [SecurityEventModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
