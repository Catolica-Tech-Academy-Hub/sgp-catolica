import { Controller, Get, UseGuards } from '@nestjs/common';
import type { Estudante } from '@sgp/shared-types';
import { ApenasProfessorGuard, ProfessorAtual } from '../autenticacao/professor';
import { EstudantesService } from './estudantes.service';

@Controller('estudantes')
@UseGuards(ApenasProfessorGuard)
export class EstudantesController {
  constructor(private readonly estudantes: EstudantesService) {}

  @Get()
  listar(@ProfessorAtual() professorId: string): Promise<Estudante[]> {
    return this.estudantes.listar(professorId);
  }
}
