import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApenasProfessorGuard, ProfessorAtual } from '../autenticacao/professor';
import type { ProvaComBlocos } from './mapeadores';
import { SalvarProvaDto } from './provas.dto';
import { ProvasService } from './provas.service';

/** RF04: provas do professor. */
@Controller('provas')
@UseGuards(ApenasProfessorGuard)
export class ProvasController {
  constructor(private readonly provas: ProvasService) {}

  @Get()
  listar(@ProfessorAtual() professorId: string): Promise<ProvaComBlocos[]> {
    return this.provas.listar(professorId);
  }

  @Put(':id')
  salvar(
    @ProfessorAtual() professorId: string,
    @Param('id') id: string,
    @Body() dados: SalvarProvaDto,
  ): Promise<ProvaComBlocos> {
    return this.provas.salvar(professorId, id, dados);
  }
}
