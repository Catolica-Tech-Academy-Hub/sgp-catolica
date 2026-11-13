import type { StatusMatricula, StatusTurma } from '@sgp/shared-types';

/**
 * O que fazer quando o professor matricula um estudante por e-mail (RF03).
 *
 * Fica separada do servico, sem banco, para ser coberta pelos testes da API (#107) sem
 * precisar de MySQL: recebe o que ja foi lido e devolve a decisao.
 */
export type DecisaoDeMatricula =
  | { tipo: 'criar' }
  /** Havia uma matricula removida: o banco so admite uma linha por turma e estudante. */
  | { tipo: 'reativar' }
  | { tipo: 'recusar'; motivo: MotivoDeRecusa };

export type MotivoDeRecusa = 'turma-arquivada' | 'estudante-inexistente' | 'ja-matriculado';

export const mensagemDaRecusa: Record<MotivoDeRecusa, string> = {
  'turma-arquivada': 'Turma arquivada nao aceita matricula nova.',
  'estudante-inexistente': 'Nao ha conta de estudante com este e-mail.',
  'ja-matriculado': 'Este estudante ja esta matriculado na turma.',
};

export function decidirMatricula(entrada: {
  statusDaTurma: StatusTurma;
  /** Conta de estudante encontrada pelo e-mail; ausente quando nao ha. */
  estudante?: { anonimizado: boolean };
  /** Matricula ja existente desse estudante nesta turma, ativa ou removida. */
  matriculaExistente?: { status: StatusMatricula };
}): DecisaoDeMatricula {
  if (entrada.statusDaTurma === 'archived') return { tipo: 'recusar', motivo: 'turma-arquivada' };

  // Conta anonimizada (RF01.1) deixou de identificar uma pessoa: nao pode ser matriculada.
  if (!entrada.estudante || entrada.estudante.anonimizado) {
    return { tipo: 'recusar', motivo: 'estudante-inexistente' };
  }

  if (entrada.matriculaExistente?.status === 'active') {
    return { tipo: 'recusar', motivo: 'ja-matriculado' };
  }

  return entrada.matriculaExistente ? { tipo: 'reativar' } : { tipo: 'criar' };
}

/** E-mail como e comparado: sem espacos nas pontas e em minusculas. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}
