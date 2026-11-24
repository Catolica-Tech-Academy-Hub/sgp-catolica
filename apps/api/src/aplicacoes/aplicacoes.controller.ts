import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { Correcao, GabaritoVersaoSnapshot } from '@sgp/shared-types';
import { ApenasProfessorGuard, ProfessorAtual } from '../autenticacao/professor';
import { AtribuicaoService } from '../correcoes/atribuicao.service';
import { type AplicacaoParaCorrigir, AplicacoesService } from './aplicacoes.service';

/** RF08: o que o aplicativo do professor precisa para corrigir. */
@Controller('aplicacoes')
@UseGuards(ApenasProfessorGuard)
export class AplicacoesController {
  constructor(
    private readonly aplicacoes: AplicacoesService,
    private readonly atribuicao: AtribuicaoService,
  ) {}

  @Get('para-corrigir')
  listarParaCorrigir(@ProfessorAtual() professorId: string): Promise<AplicacaoParaCorrigir[]> {
    return this.aplicacoes.listarParaCorrigir(professorId);
  }

  @Get(':id/gabaritos')
  gabaritos(
    @ProfessorAtual() professorId: string,
    @Param('id') id: string,
  ): Promise<GabaritoVersaoSnapshot[]> {
    return this.aplicacoes.gabaritos(professorId, id);
  }

  /** RF09: correcoes de prova sem identificacao que ainda esperam o estudante. */
  @Get(':id/correcoes-pendentes')
  correcoesPendentes(
    @ProfessorAtual() professorId: string,
    @Param('id') id: string,
  ): Promise<Correcao[]> {
    return this.atribuicao.listarPendentes(professorId, id);
  }
}
