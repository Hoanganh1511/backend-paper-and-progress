import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ZodType } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CertificatesService } from './certificates.service.js';
import {
  createCertificateSchema,
  listCertificatesQuerySchema,
  resourceSchema,
  updateCertificateSchema,
} from './certificates.schema.js';

type AuthedRequest = { user: { sub: string } };

function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException(result.error.issues.map((i) => i.message));
  }
  return result.data;
}

// The fixed path (resources/...) comes before the ':id' routes.
@Controller('api/v1/certificates')
@UseGuards(JwtAuthGuard)
export class CertificatesController {
  constructor(private service: CertificatesService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query() query: unknown) {
    return this.service.list(
      req.user.sub,
      parse(listCertificatesQuerySchema, query),
    );
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.service.create(
      req.user.sub,
      parse(createCertificateSchema, body),
    );
  }

  @Delete('resources/:resourceId')
  @HttpCode(200)
  removeResource(
    @Req() req: AuthedRequest,
    @Param('resourceId') resourceId: string,
  ) {
    return this.service.removeResource(req.user.sub, resourceId);
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.get(req.user.sub, id);
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.update(
      req.user.sub,
      id,
      parse(updateCertificateSchema, body),
    );
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.remove(req.user.sub, id);
  }

  @Post(':id/resources')
  addResource(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.addResource(
      req.user.sub,
      id,
      parse(resourceSchema, body),
    );
  }
}
