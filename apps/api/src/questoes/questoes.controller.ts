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
} from '@nestjs/common';
import type { Questao } from '@sgp/shared-types';
import { SalvarQuestaoDto } from './questoes.dto';
import { QuestoesService } from './questoes.service';

/** RF02: banco de questoes do professor. */
@Controller('questoes')
export class QuestoesController {
  constructor(private readonly questoes: QuestoesService) {}

  @Get()
  listar(
    @Query('incluirExcluidas', new ParseBoolPipe({ optional: true })) incluirExcluidas?: boolean,
  ): Promise<Questao[]> {
    return this.questoes.listar(incluirExcluidas ?? false);
  }

  @Get(':id')
  obter(@Param('id') id: string): Promise<Questao> {
    return this.questoes.obter(id);
  }

  @Put(':id')
  salvar(@Param('id') id: string, @Body() dados: SalvarQuestaoDto): Promise<Questao> {
    return this.questoes.salvar(id, dados);
  }

  @Delete(':id')
  excluir(@Param('id') id: string): Promise<Questao> {
    return this.questoes.alterarExclusao(id, true);
  }

  @Post(':id/restaurar')
  restaurar(@Param('id') id: string): Promise<Questao> {
    return this.questoes.alterarExclusao(id, false);
  }
}
