import { type ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import type { RequisicaoIdentificada, UsuarioAutenticado } from './usuario-autenticado';

export const CHAVE_ACEITA_SEM_LOGIN = 'sgp:aceita-sem-login';

/**
 * Rota que tambem atende quem ainda nao tem sessao, como a entrada pelo codigo de convite
 * (RF03). A identificacao provisoria nao preenche ninguem nela; com o login da #81, o
 * token passa a ser opcional aqui e obrigatorio no resto.
 */
export const AceitaSemLogin = () => SetMetadata(CHAVE_ACEITA_SEM_LOGIN, true);

/** Quem fez a requisicao, ou `undefined` numa rota `@AceitaSemLogin()` sem sessao. */
export const UsuarioAtual = createParamDecorator(
  (_dado: unknown, contexto: ExecutionContext): UsuarioAutenticado | undefined =>
    contexto.switchToHttp().getRequest<RequisicaoIdentificada>().usuario,
);
