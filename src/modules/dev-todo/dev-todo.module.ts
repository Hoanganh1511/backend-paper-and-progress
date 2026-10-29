import { Module } from '@nestjs/common';
import { DevTodoController } from './presentation/controllers/dev-todo.controller.js';
import { DevTodoService } from './application/dev-todo.service.js';
import { DevOnlyGuard } from './presentation/guards/dev-only.guard.js';

@Module({
  controllers: [DevTodoController],
  providers: [DevTodoService, DevOnlyGuard],
})
export class DevTodoModule {}
