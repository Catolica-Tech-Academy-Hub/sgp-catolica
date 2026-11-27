import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { Estudante, Matricula, Turma } from '@sgp/shared-types';
import { ApenasProfessorGuard, ProfessorAtual } from '../autenticacao/professor';
import { AtualizarTurmaDto, CriarTurmaDto, MatricularPorEmailDto } from './turmas.dto';
import { TurmasService } from './turmas.service';

/** RF03: turmas do professor. */
@Controller('turmas')
@UseGuards(ApenasProfessorGuard)
export class TurmasController {
  constructor(private readonly turmas: TurmasService) {}

  @Get()
  listar(@ProfessorAtual() professorId: string): Promise<Turma[]> {
    return this.turmas.listar(professorId);
  }

  @Post()
  criar(@ProfessorAtual() professorId: string, @Body() dados: CriarTurmaDto): Promise<Turma> {
    return this.turmas.criar(professorId, dados);
  }

  @Patch(':id')
  atualizar(
    @ProfessorAtual() professorId: string,
    @Param('id') id: string,
    @Body() dados: AtualizarTurmaDto,
  ): Promise<Turma> {
    return this.turmas.atualizar(professorId, id, dados);
  }

  @Post(':id/arquivar')
  arquivar(@ProfessorAtual() professorId: string, @Param('id') id: string): Promise<Turma> {
    return this.turmas.arquivar(professorId, id);
  }

  @Post(':id/codigo-de-convite')
  regenerarCodigoDeConvite(
    @ProfessorAtual() professorId: string,
    @Param('id') id: string,
  ): Promise<Turma> {
    return this.turmas.regenerarCodigoDeConvite(professorId, id);
  }

  /** RF03: o professor matricula, por e-mail, um estudante ja cadastrado. */
  @Post(':id/matriculas')
  matricularPorEmail(
    @ProfessorAtual() professorId: string,
    @Param('id') id: string,
    @Body() dados: MatricularPorEmailDto,
  ): Promise<{ matricula: Matricula; estudante: Estudante }> {
    return this.turmas.matricularPorEmail(professorId, id, dados.email);
  }
}

/** RF03: matriculas nas turmas do professor. */
@Controller('matriculas')
@UseGuards(ApenasProfessorGuard)
export class MatriculasController {
  constructor(private readonly turmas: TurmasService) {}

  @Get()
  listar(@ProfessorAtual() professorId: string): Promise<Matricula[]> {
    return this.turmas.listarMatriculas(professorId);
  }

  @Delete(':id')
  remover(@ProfessorAtual() professorId: string, @Param('id') id: string): Promise<Matricula> {
    return this.turmas.alterarSituacaoDaMatricula(professorId, id, 'removed');
  }

  @Post(':id/restaurar')
  restaurar(@ProfessorAtual() professorId: string, @Param('id') id: string): Promise<Matricula> {
    return this.turmas.alterarSituacaoDaMatricula(professorId, id, 'active');
  }
}
