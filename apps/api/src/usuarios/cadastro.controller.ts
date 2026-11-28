import { Body, Controller, Post } from '@nestjs/common';
import type { Estudante, Professor } from '@sgp/shared-types';
import { AceitaSemLogin } from '../autenticacao/aceita-sem-login';
import { CadastroDto } from './cadastro.dto';
import { CadastroService } from './cadastro.service';

/** RF01 (#80): quem se cadastra ainda nao tem sessao. */
@Controller('auth')
@AceitaSemLogin()
export class CadastroController {
  constructor(private readonly cadastro: CadastroService) {}

  @Post('cadastro')
  cadastrar(@Body() dados: CadastroDto): Promise<Professor | Estudante> {
    return this.cadastro.cadastrar(dados);
  }
}
