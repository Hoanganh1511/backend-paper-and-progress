import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
//import path has ".js" because of project using ESM
@Global()
// Global for can use PrismaService without re-import DatabaseModule

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
