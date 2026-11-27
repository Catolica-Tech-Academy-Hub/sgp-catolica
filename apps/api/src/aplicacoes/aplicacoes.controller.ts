import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { Aplicacao } from '@sgp/shared-types';
import { ApenasProfessorGuard, ProfessorAtual } from '../autenticacao/professor';
import { CriarAplicacaoDto, GerarVersoesDto } from './aplicacoes.dto';
import { AplicacoesService } from './aplicacoes.service';

/** Aplicações do professor atual (RF05). */
@Controller('aplicacoes')
@UseGuards(ApenasProfessorGuard)
export class AplicacoesController {
  constructor(private readonly aplicacoes: AplicacoesService) {}

  @Get()
  listar(@ProfessorAtual() professorId: string): Promise<Aplicacao[]> {
    return this.aplicacoes.listar(professorId);
  }

  @Get(':id')
  obter(@ProfessorAtual() professorId: string, @Param('id') id: string): Promise<Aplicacao> {
    return this.aplicacoes.obter(professorId, id);
  }

  @Post()
  criar(
    @ProfessorAtual() professorId: string,
    @Body() dados: CriarAplicacaoDto,
  ): Promise<Aplicacao> {
    return this.aplicacoes.criar(professorId, dados);
  }

  @Post(':id/gerar')
  gerar(
    @ProfessorAtual() professorId: string,
    @Param('id') id: string,
    @Body() dados: GerarVersoesDto,
  ): ReturnType<AplicacoesService['gerarVersoes']> {
    return this.aplicacoes.gerarVersoes(professorId, id, dados);
  }
}
