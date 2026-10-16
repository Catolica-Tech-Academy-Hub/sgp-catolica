import { Controller, Get } from '@nestjs/common';
import type { Estudante } from '@sgp/shared-types';
import { EstudantesService } from './estudantes.service';

@Controller('estudantes')
export class EstudantesController {
  constructor(private readonly estudantes: EstudantesService) {}

  @Get()
  listar(): Promise<Estudante[]> {
    return this.estudantes.listar();
  }
}
