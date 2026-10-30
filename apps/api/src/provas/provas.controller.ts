import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import type { ProvaComBlocos } from './mapeadores';
import { SalvarProvaDto } from './provas.dto';
import { ProvasService } from './provas.service';

/** RF04: provas do professor. */
@Controller('provas')
export class ProvasController {
  constructor(private readonly provas: ProvasService) {}

  @Get()
  listar(): Promise<ProvaComBlocos[]> {
    return this.provas.listar();
  }

  @Put(':id')
  salvar(@Param('id') id: string, @Body() dados: SalvarProvaDto): Promise<ProvaComBlocos> {
    return this.provas.salvar(id, dados);
  }
}
