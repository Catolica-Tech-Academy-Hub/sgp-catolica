import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { Aplicacao, GabaritoVersaoSnapshot } from '@sgp/shared-types';
import { ApenasProfessorGuard, ProfessorAtual } from '../autenticacao/professor';
import { CriarAplicacaoDto, GerarVersoesDto } from './aplicacoes.dto';
import { type AplicacaoParaCorrigir, AplicacoesService } from './aplicacoes.service';

/** Aplicações do professor atual (RF05). */
@Controller('aplicacoes')
@UseGuards(ApenasProfessorGuard)
export class AplicacoesController {
  constructor(private readonly aplicacoes: AplicacoesService) {}

  /** RF08: so as geradas, com o que o aplicativo do professor precisa para corrigir. */
  @Get('para-corrigir')
  listarParaCorrigir(@ProfessorAtual() professorId: string): Promise<AplicacaoParaCorrigir[]> {
    return this.aplicacoes.listarParaCorrigir(professorId);
  }

  @Get()
  listar(@ProfessorAtual() professorId: string): Promise<Aplicacao[]> {
    return this.aplicacoes.listar(professorId);
  }

  @Get(':id/gabaritos')
  gabaritos(
    @ProfessorAtual() professorId: string,
    @Param('id') id: string,
  ): Promise<GabaritoVersaoSnapshot[]> {
    return this.aplicacoes.gabaritos(professorId, id);
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
