import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.enableCors({
    origin: configService.get<string[]>('CORS_ORIGINS'),
    credentials: true,
    exposedHeaders: ['Retry-After'],
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
