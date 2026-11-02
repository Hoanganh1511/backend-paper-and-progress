import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { UPLOAD_DIR } from './modules/articles/services/upload.service.js';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Images uploaded in development (no S3 bucket) are served from the uploads folder.
  app.useStaticAssets(UPLOAD_DIR, { prefix: '/uploads' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const configService = app.get(ConfigService);
  app.enableCors({
    origin: configService.get<string[]>('CORS_ORIGINS'),
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Paper & Progress API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);
  await app.listen(8000);
  console.log(`🚀 App running on http://localhost:${8000}`);
}
await bootstrap();
