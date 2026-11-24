import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApenasProfessorGuard, ProfessorAtual } from '../autenticacao/professor';
import { SincronizarLoteDto } from './correcoes.dto';
import { CorrecoesService, type ResultadoDaSincronizacao } from './correcoes.service';

/** RF08: sincronizacao da fila de correcoes do aplicativo do professor. */
@Controller('correcoes')
@UseGuards(ApenasProfessorGuard)
export class CorrecoesController {
  constructor(private readonly correcoes: CorrecoesService) {}

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
}
