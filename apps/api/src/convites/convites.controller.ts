import { Body, Controller, Get, HttpCode, Param, Post, ValidationPipe } from '@nestjs/common';
import { AceitaSemLogin, UsuarioAtual } from '../autenticacao/aceita-sem-login';
import type { UsuarioAutenticado } from '../autenticacao/usuario-autenticado';
import { CadastroPeloConviteDto } from './convites.dto';
import { ConvitesService, type ResultadoDaEntrada, type TurmaDoConvite } from './convites.service';

/** Mesmas opcoes do pipe global (`main.ts`). */
const validacao = new ValidationPipe({ whitelist: true, transform: true });

/**
 * RF03: entrada do estudante pelo codigo de convite, inclusive para quem ainda nao tem
 * conta. Por isso as rotas aceitam requisicao sem sessao.
 */
@Controller('convites')
@AceitaSemLogin()
export class ConvitesController {
  constructor(private readonly convites: ConvitesService) {}

  /** O que a tela mostra antes de confirmar: turma, disciplina, periodo e professor. */
  @Get(':codigo')
  consultar(@Param('codigo') codigo: string): Promise<TurmaDoConvite> {
    return this.convites.consultar(codigo);
  }

  /**
   * Com sessao de estudante, o corpo e ignorado. Sem sessao, o corpo e o cadastro
   * (`CadastroPeloConviteDto`), validado so nesse caso.
   */
  @Post(':codigo/matricula')
  @HttpCode(200)
  entrar(
    @Param('codigo') codigo: string,
    @UsuarioAtual() usuario: UsuarioAutenticado | undefined,
    @Body() corpo: unknown,
  ): Promise<ResultadoDaEntrada> {
    return this.convites.entrar(
      codigo,
      usuario,
      () =>
        validacao.transform(corpo ?? {}, {
          type: 'body',
          metatype: CadastroPeloConviteDto,
        }) as Promise<CadastroPeloConviteDto>,
    );
  }
}
