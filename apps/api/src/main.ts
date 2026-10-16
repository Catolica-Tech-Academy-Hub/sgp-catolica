import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function iniciar(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' });
  // `whitelist` descarta campos que o DTO nao declara, em vez de grava-los no banco.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const porta = Number(process.env.PORT ?? 3000);
  await app.listen(porta);
  console.log(`API do SGP em http://localhost:${porta}`);
}

void iniciar();
