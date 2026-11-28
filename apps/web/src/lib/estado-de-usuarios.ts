/**
 * Cadastro de professor e de estudante (RF01, issues #80 e #84).
 *
 * Só existe com a API ligada (`VITE_API_URL`): uma conta é um registro do servidor, e no
 * modo de demonstração não há onde gravá-la. A tela consulta `cadastroDisponivel` para
 * explicar isso em vez de fingir que cadastrou.
 *
 * As regras de domínio repetem as da API (`apps/api/src/usuarios/regras.ts`) só para o
 * aviso aparecer junto do campo antes do envio; quem decide é o servidor.
 */
import type { Estudante, PapelUsuario, Professor } from '@sgp/shared-types';
import { apiLigada, ErroDaApi, requisitar } from './api';

export const cadastroDisponivel = apiLigada;

export const DOMINIO_POR_PAPEL: Record<PapelUsuario, string> = {
  estudante: '@catolicasc.edu.br',
  professor: '@catolicasc.org.br',
};

export const SENHA_MINIMA = 8;
export const SENHA_MAXIMA = 72;

export function emailDoPapel(email: string, papel: PapelUsuario): boolean {
  const normalizado = email.trim().toLowerCase();
  const dominio = DOMINIO_POR_PAPEL[papel];
  return normalizado.endsWith(dominio) && normalizado.length > dominio.length;
}

export interface DadosDoCadastro {
  role: PapelUsuario;
  fullName: string;
  email: string;
  password: string;
  registration?: string;
}

export type ResultadoDoCadastro =
  { ok: true; usuario: Professor | Estudante } | { ok: false; erro: string };

export async function cadastrarUsuario(dados: DadosDoCadastro): Promise<ResultadoDoCadastro> {
  if (!cadastroDisponivel) {
    return { ok: false, erro: 'O cadastro precisa do servidor, e ele não está ligado.' };
  }

  try {
    const usuario = await requisitar<Professor | Estudante>('/auth/cadastro', {
      method: 'POST',
      body: JSON.stringify({
        ...dados,
        email: dados.email.trim(),
        fullName: dados.fullName.trim(),
        registration:
          dados.role === 'estudante' ? dados.registration?.trim() || undefined : undefined,
      }),
    });
    return { ok: true, usuario };
  } catch (erro) {
    if (erro instanceof ErroDaApi && erro.status === 409) {
      return {
        ok: false,
        erro: 'Já existe uma conta com este e-mail ou matrícula. Entre com ela.',
      };
    }
    if (erro instanceof ErroDaApi && erro.status === 400) {
      return { ok: false, erro: 'Confira os dados: o servidor recusou o cadastro.' };
    }
    return { ok: false, erro: 'Não foi possível falar com o servidor. Tente de novo.' };
  }
}
