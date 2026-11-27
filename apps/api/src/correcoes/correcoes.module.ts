import { Module } from '@nestjs/common';
import { AtribuicaoService } from './atribuicao.service';
import { CorrecoesController } from './correcoes.controller';
import { CorrecoesService } from './correcoes.service';

@Module({
  controllers: [CorrecoesController],
  providers: [CorrecoesService, AtribuicaoService],
  exports: [AtribuicaoService],
})
export class CorrecoesModule {}
