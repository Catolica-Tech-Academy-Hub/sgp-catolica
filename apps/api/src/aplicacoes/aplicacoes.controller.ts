import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { Aplicacao } from '@sgp/shared-types';
import { CriarAplicacaoDto, GerarVersoesDto } from './aplicacoes.dto';
import { AplicacoesService } from './aplicacoes.service';

/** Aplicações do professor atual (RF05). */
@Controller('aplicacoes')
export class AplicacoesController {
  constructor(private readonly aplicacoes: AplicacoesService) {}

  @Get()
  listar(): Promise<Aplicacao[]> {
    return this.aplicacoes.listar();
  }

  @Get(':id')
  obter(@Param('id') id: string): Promise<Aplicacao> {
    return this.aplicacoes.obter(id);
  }

  @Post()
  criar(@Body() dados: CriarAplicacaoDto): Promise<Aplicacao> {
    return this.aplicacoes.criar(dados);
  }

  @Post(':id/gerar')
  gerar(
    @Param('id') id: string,
    @Body() dados: GerarVersoesDto,
  ): ReturnType<AplicacoesService['gerarVersoes']> {
    return this.aplicacoes.gerarVersoes(id, dados);
  }
}
