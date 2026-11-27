import { Injectable, NotImplementedException } from '@nestjs/common';

/** Sessao devolvida ao estudante recem-cadastrado (RF03: ja autenticado). */
export interface SessaoDoEstudante {
  accessToken: string;
  refreshToken: string;
}

/**
 * Ponto de integracao explicito com o login (issue #81): o que o cadastro pelo convite
 * precisa e ainda nao existe. Guardar a senha e abrir a sessao sao decisoes da #81 (formato
 * do hash, JWT e refresh token); quando ela entrar, registra a implementacao real neste
 * token e o `ConvitesService` nao muda.
 */
export interface CredenciaisDoEstudante {
  /** Transforma a senha no valor gravado em `usuarios.passwordHash`. */
  prepararSenha(senha: string): Promise<string>;
  abrirSessao(estudante: { id: string }): Promise<SessaoDoEstudante>;
}

export const CREDENCIAIS_DO_ESTUDANTE = Symbol('CredenciaisDoEstudante');

const MENSAGEM = 'O cadastro pelo codigo de convite depende do login (issue #81).';

/**
 * Enquanto o login nao existe, o cadastro responde 501. `prepararSenha` e chamada antes da
 * transacao, entao nenhuma conta fica criada pela metade.
 */
@Injectable()
export class CredenciaisIndisponiveis implements CredenciaisDoEstudante {
  prepararSenha(): Promise<string> {
    return Promise.reject(new NotImplementedException(MENSAGEM));
  }

  abrirSessao(): Promise<SessaoDoEstudante> {
    return Promise.reject(new NotImplementedException(MENSAGEM));
  }
}
