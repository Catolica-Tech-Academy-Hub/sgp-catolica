import type { StatusMatricula, StatusTurma } from '@sgp/shared-types';
import { DOMINIO_POR_PAPEL, emailDoPapel, normalizarEmail } from '../usuarios/regras';

/**
 * O que fazer quando o estudante entra numa turma pelo codigo de convite (RF03).
 *
 * Fica separada do servico, sem banco, para ser testada sem MySQL: recebe o que ja foi
 * lido e devolve a decisao.
 */
export type DecisaoDeEntrada =
  | { tipo: 'matricular' }
  /** O mesmo codigo usado de novo: devolve a matricula que ja existe, sem duplicar. */
  | { tipo: 'ja-matriculado' }
  | { tipo: 'recusar'; motivo: MotivoDeRecusa };

export type MotivoDeRecusa = 'codigo-invalido' | 'turma-arquivada' | 'matricula-removida';

export const mensagemDaRecusa: Record<MotivoDeRecusa, string> = {
  'codigo-invalido': 'Codigo de convite invalido ou substituido. Peca o codigo atual ao professor.',
  'turma-arquivada': 'Esta turma foi arquivada e nao aceita novas matriculas.',
  'matricula-removida':
    'Sua matricula nesta turma foi removida pelo professor. Fale com ele para voltar.',
};

export function decidirEntrada(entrada: {
  /** Turma com este codigo; ausente quando nenhum codigo vigente bate. */
  turma?: { status: StatusTurma };
  /** Matricula ja existente do estudante nesta turma, ativa ou removida. */
  matriculaExistente?: { status: StatusMatricula };
}): DecisaoDeEntrada {
  // Codigo regenerado nao bate com mais nenhuma turma: deixa de valer na hora.
  if (!entrada.turma) return { tipo: 'recusar', motivo: 'codigo-invalido' };
  if (entrada.matriculaExistente?.status === 'active') return { tipo: 'ja-matriculado' };
  if (entrada.turma.status === 'archived') return { tipo: 'recusar', motivo: 'turma-arquivada' };
  // Quem o professor removeu nao volta sozinho pelo link: a remocao foi uma decisao dele.
  if (entrada.matriculaExistente) return { tipo: 'recusar', motivo: 'matricula-removida' };
  return { tipo: 'matricular' };
}

/** Codigo como e comparado: sem espacos nas pontas e em maiusculas. */
export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase();
}

/** RF01: conta de estudante so com o dominio institucional de estudante. */
export const DOMINIO_DE_ESTUDANTE = DOMINIO_POR_PAPEL.estudante;

export { normalizarEmail };

export function emailDeEstudante(email: string): boolean {
  return emailDoPapel(email, 'estudante');
}
