import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function iniciar(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Os blocos da prova podem trazer imagens em data URL; o limite padrao (100 KB) nao basta.
  app.useBodyParser('json', { limit: '5mb' });

  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' });
  // `whitelist` descarta campos que o DTO nao declara, em vez de grava-los no banco.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const porta = Number(process.env.PORT ?? 3000);
  await app.listen(porta);
  console.log(`API do SGP em http://localhost:${porta}`);
}

void iniciar();
