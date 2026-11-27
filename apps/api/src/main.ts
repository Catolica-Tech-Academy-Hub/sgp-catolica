import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { logger } from './observabilidade/logger-json';
import { registrarRequisicoes } from './observabilidade/registro-de-requisicoes';

async function iniciar(): Promise<void> {
  // `bufferLogs` segura os logs da inicializacao ate o logger JSON estar no lugar.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(logger);

  // Antes de tudo, para medir a requisicao inteira, inclusive as recusadas pela validacao.
  app.use(registrarRequisicoes);

  // Os blocos da prova podem trazer imagens em data URL; o limite padrao (100 KB) nao basta.
  app.useBodyParser('json', { limit: '5mb' });

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    // A tela pode ler o id da requisicao para relatar um erro.
    exposedHeaders: ['X-Request-Id'],
  });
  // `whitelist` descarta campos que o DTO nao declara, em vez de grava-los no banco.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const porta = Number(process.env.PORT ?? 3000);
  await app.listen(porta);
  logger.log(`API do SGP em http://localhost:${porta}`, 'Inicio');
}

void iniciar();
