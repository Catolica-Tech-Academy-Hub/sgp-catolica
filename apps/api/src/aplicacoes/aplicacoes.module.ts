import { Module } from '@nestjs/common';
import { AplicacoesController } from './aplicacoes.controller';
import { AplicacoesService } from './aplicacoes.service';

@Module({
  controllers: [AplicacoesController],
  providers: [AplicacoesService],
})
export class AplicacoesModule {}
