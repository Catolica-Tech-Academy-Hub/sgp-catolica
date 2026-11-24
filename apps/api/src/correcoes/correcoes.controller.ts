import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { Correcao } from '@sgp/shared-types';
import { ApenasProfessorGuard, ProfessorAtual } from '../autenticacao/professor';
import { AtribuicaoService } from './atribuicao.service';
import { AtribuirCorrecaoDto, SincronizarLoteDto } from './correcoes.dto';
import { CorrecoesService, type ResultadoDaSincronizacao } from './correcoes.service';

/** RF08: sincronizacao da fila de correcoes do aplicativo do professor. */
@Controller('correcoes')
@UseGuards(ApenasProfessorGuard)
export class CorrecoesController {
  constructor(
    private readonly correcoes: CorrecoesService,
    private readonly atribuicao: AtribuicaoService,
  ) {}

  /** RF09: todas as correcoes do professor, para a fila de atribuicao manual. */
  @Get()
  listar(@ProfessorAtual() professorId: string): Promise<Correcao[]> {
    return this.atribuicao.listar(professorId);
  }

  /** 200 mesmo com itens em erro: o resultado de cada um vem na resposta. */
  @Post('lote')
  @HttpCode(200)
  sincronizarLote(
    @ProfessorAtual() professorId: string,
    @Body() dados: SincronizarLoteDto,
  ): Promise<{ resultados: ResultadoDaSincronizacao[] }> {
    return this.correcoes
      .sincronizarLote(professorId, dados.itens)
      .then((resultados) => ({ resultados }));
  }

  /** RF09: preenche o estudante na correcao existente, sem criar outra. */
  @Post(':id/atribuir')
  @HttpCode(200)
  atribuir(
    @ProfessorAtual() professorId: string,
    @Param('id') id: string,
    @Body() dados: AtribuirCorrecaoDto,
  ): Promise<Correcao> {
    return this.atribuicao.atribuir(professorId, id, dados);
  }

  /** RF09: "Desfazer" da tela; a correcao volta para a fila de pendentes. */
  @Post(':id/desfazer-atribuicao')
  @HttpCode(200)
  desfazerAtribuicao(
    @ProfessorAtual() professorId: string,
    @Param('id') id: string,
  ): Promise<Correcao> {
    return this.atribuicao.desfazerAtribuicao(professorId, id);
  }
}
