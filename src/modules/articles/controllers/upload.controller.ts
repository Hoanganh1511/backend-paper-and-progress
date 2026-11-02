import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { presignSchema } from '../articles.schema.js';
import { parse, type AuthedRequest } from '../parse.js';
import { MAX_IMAGE_BYTES, UploadService } from '../services/upload.service.js';

@Controller('api/v1/uploads')
export class UploadController {
  constructor(private uploads: UploadService) {}

  @Post('presign')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CREATOR', 'ADMIN')
  presign(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.uploads.presign(req.user.sub, parse(presignSchema, body));
  }

  /** Development only (no S3 bucket): the link from `presign` carries its own signature. */
  @Post('local/:key')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  local(
    @Param('key') key: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @UploadedFile() file?: { buffer: Buffer; size: number },
  ) {
    return this.uploads.saveLocal(key, Number(expires), signature ?? '', file);
  }
}
