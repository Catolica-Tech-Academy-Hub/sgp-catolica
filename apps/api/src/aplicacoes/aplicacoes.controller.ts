import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { Aplicacao, Correcao, GabaritoVersaoSnapshot } from '@sgp/shared-types';
import { ApenasProfessorGuard, ProfessorAtual } from '../autenticacao/professor';
import { AtribuicaoService } from '../correcoes/atribuicao.service';
import { CriarAplicacaoDto, GerarPdfDto, GerarVersoesDto } from './aplicacoes.dto';
import { type AplicacaoParaCorrigir, AplicacoesService } from './aplicacoes.service';

/** Aplicações do professor atual (RF05). */
@Controller('aplicacoes')
@UseGuards(ApenasProfessorGuard)
export class AplicacoesController {
  constructor(
    private readonly aplicacoes: AplicacoesService,
    private readonly atribuicao: AtribuicaoService,
  ) {}

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

  /** RF09: correcoes de prova sem identificacao que ainda esperam o estudante. */
  @Get(':id/correcoes-pendentes')
  correcoesPendentes(
    @ProfessorAtual() professorId: string,
    @Param('id') id: string,
  ): Promise<Correcao[]> {
    return this.atribuicao.listarPendentes(professorId, id);
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

  @Post(':id/gerar-pdf')
  gerarPdf(
    @ProfessorAtual() professorId: string,
    @Param('id') id: string,
    @Body() dados: GerarPdfDto,
  ): ReturnType<AplicacoesService['gerarPdf']> {
    return this.aplicacoes.gerarPdf(professorId, id, dados);
  }

  @Get(':id/pdf')
  async baixarPdf(
    @ProfessorAtual() professorId: string,
    @Param('id') id: string,
    @Res() resposta: Response,
  ): Promise<void> {
    const pdf = await this.aplicacoes.obterPdf(professorId, id);
    const nomeSeguro = id.replace(/[^a-zA-Z0-9_-]/g, '') || 'aplicacao';
    resposta
      .status(200)
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="prova-${nomeSeguro}.pdf"`,
        'Content-Length': String(pdf.length),
        'Cache-Control': 'private, no-store',
      })
      .send(pdf);
  }
}
