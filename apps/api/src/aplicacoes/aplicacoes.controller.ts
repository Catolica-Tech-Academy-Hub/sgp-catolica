import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Aplicacao } from '@sgp/shared-types';
import { CriarAplicacaoDto, GerarPdfDto, GerarVersoesDto } from './aplicacoes.dto';
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

  @Post(':id/gerar-pdf')
  gerarPdf(
    @Param('id') id: string,
    @Body() dados: GerarPdfDto,
  ): ReturnType<AplicacoesService['gerarPdf']> {
    return this.aplicacoes.gerarPdf(id, dados);
  }

  @Get(':id/pdf')
  async baixarPdf(@Param('id') id: string, @Res() resposta: Response): Promise<void> {
    const pdf = await this.aplicacoes.obterPdf(id);
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
