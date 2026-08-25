import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const uploadDir = config.get<string>('upload.dir', './uploads');
  mkdirSync(uploadDir, { recursive: true });
  app.useStaticAssets(join(process.cwd(), uploadDir), { prefix: '/uploads/' });

  const port = config.get<number>('port', 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`API sẵn sàng tại http://localhost:${port}/api/v1`);
}

void bootstrap();
