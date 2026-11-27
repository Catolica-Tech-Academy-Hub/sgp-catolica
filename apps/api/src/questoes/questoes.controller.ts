import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Questao } from '@sgp/shared-types';
import { ApenasProfessorGuard, ProfessorAtual } from '../autenticacao/professor';
import { SalvarQuestaoDto } from './questoes.dto';
import { QuestoesService } from './questoes.service';

/** RF02: banco de questoes do professor. */
@Controller('questoes')
@UseGuards(ApenasProfessorGuard)
export class QuestoesController {
  constructor(private readonly questoes: QuestoesService) {}

  @Get()
  listar(
    @ProfessorAtual() professorId: string,
    @Query('incluirExcluidas', new ParseBoolPipe({ optional: true })) incluirExcluidas?: boolean,
  ): Promise<Questao[]> {
    return this.questoes.listar(professorId, incluirExcluidas ?? false);
  }

  @Get(':id')
  obter(@ProfessorAtual() professorId: string, @Param('id') id: string): Promise<Questao> {
    return this.questoes.obter(professorId, id);
  }

  @Put(':id')
  salvar(
    @ProfessorAtual() professorId: string,
    @Param('id') id: string,
    @Body() dados: SalvarQuestaoDto,
  ): Promise<Questao> {
    return this.questoes.salvar(professorId, id, dados);
  }

  @Delete(':id')
  excluir(@ProfessorAtual() professorId: string, @Param('id') id: string): Promise<Questao> {
    return this.questoes.alterarExclusao(professorId, id, true);
  }

  @Post(':id/restaurar')
  restaurar(@ProfessorAtual() professorId: string, @Param('id') id: string): Promise<Questao> {
    return this.questoes.alterarExclusao(professorId, id, false);
  }
}
