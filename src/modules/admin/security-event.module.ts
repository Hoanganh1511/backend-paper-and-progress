import { Global, Module } from '@nestjs/common';
import { SecurityEventService } from './services/security-event.service.js';

// Global để auth services dùng SecurityEventService mà không phải import lại
@Global()
@Module({
  providers: [SecurityEventService],
  exports: [SecurityEventService],
})
export class SecurityEventModule {}
