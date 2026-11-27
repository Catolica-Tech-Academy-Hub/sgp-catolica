import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CHAVE_ACEITA_SEM_LOGIN } from './aceita-sem-login';
import type { RequisicaoIdentificada, UsuarioAutenticado } from './usuario-autenticado';

/** Professor de demonstracao do seed (`professorMock`). */
const PROFESSOR_DE_DEMONSTRACAO: UsuarioAutenticado = { id: 'prof-1', role: 'professor' };

/**
 * Ponto de integracao explicito com a autenticacao (issue #81). Enquanto nao existe
 * login, toda requisicao e identificada como o professor de demonstracao, menos as rotas
 * `@AceitaSemLogin()`, que seguem sem usuario. Quando o JWT existir, este guard sai e
 * quem preenche `usuario` passa a ser a validacao do token; `ApenasProfessorGuard`,
 * controllers e servicos nao mudam.
 *
 * Registrado como guard global, roda antes dos guards de cada controller.
 */
@Injectable()
export class IdentificacaoProvisoriaGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const aceitaSemLogin = this.reflector.getAllAndOverride<boolean>(CHAVE_ACEITA_SEM_LOGIN, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (aceitaSemLogin) return true;

    const requisicao = contexto.switchToHttp().getRequest<RequisicaoIdentificada>();
    requisicao.usuario ??= PROFESSOR_DE_DEMONSTRACAO;
    return true;
  }
}
