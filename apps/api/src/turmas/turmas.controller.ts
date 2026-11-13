import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import type { Estudante, Matricula, Turma } from '@sgp/shared-types';
import { AtualizarTurmaDto, CriarTurmaDto, MatricularPorEmailDto } from './turmas.dto';
import { TurmasService } from './turmas.service';

/** RF03: turmas do professor. */
@Controller('turmas')
export class TurmasController {
  constructor(private readonly turmas: TurmasService) {}

  @Get()
  listar(): Promise<Turma[]> {
    return this.turmas.listar();
  }

  @Post()
  criar(@Body() dados: CriarTurmaDto): Promise<Turma> {
    return this.turmas.criar(dados);
  }

  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() dados: AtualizarTurmaDto): Promise<Turma> {
    return this.turmas.atualizar(id, dados);
  }

  @Post(':id/arquivar')
  arquivar(@Param('id') id: string): Promise<Turma> {
    return this.turmas.arquivar(id);
  }

  @Post(':id/codigo-de-convite')
  regenerarCodigoDeConvite(@Param('id') id: string): Promise<Turma> {
    return this.turmas.regenerarCodigoDeConvite(id);
  }

  /** RF03: o professor matricula, por e-mail, um estudante ja cadastrado. */
  @Post(':id/matriculas')
  matricularPorEmail(
    @Param('id') id: string,
    @Body() dados: MatricularPorEmailDto,
  ): Promise<{ matricula: Matricula; estudante: Estudante }> {
    return this.turmas.matricularPorEmail(id, dados.email);
  }
}

/** RF03: matriculas nas turmas do professor. */
@Controller('matriculas')
export class MatriculasController {
  constructor(private readonly turmas: TurmasService) {}

  @Get()
  listar(): Promise<Matricula[]> {
    return this.turmas.listarMatriculas();
  }

  @Delete(':id')
  remover(@Param('id') id: string): Promise<Matricula> {
    return this.turmas.alterarSituacaoDaMatricula(id, 'removed');
  }

  @Post(':id/restaurar')
  restaurar(@Param('id') id: string): Promise<Matricula> {
    return this.turmas.alterarSituacaoDaMatricula(id, 'active');
  }
}
