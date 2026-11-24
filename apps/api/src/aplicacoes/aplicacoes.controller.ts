import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { GabaritoVersaoSnapshot } from '@sgp/shared-types';
import { ApenasProfessorGuard, ProfessorAtual } from '../autenticacao/professor';
import { type AplicacaoParaCorrigir, AplicacoesService } from './aplicacoes.service';

/** RF08: o que o aplicativo do professor precisa para corrigir. */
@Controller('aplicacoes')
@UseGuards(ApenasProfessorGuard)
export class AplicacoesController {
  constructor(private readonly aplicacoes: AplicacoesService) {}

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
}
