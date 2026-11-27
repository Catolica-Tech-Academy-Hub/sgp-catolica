/**
 * Entrada do estudante numa turma pelo código de convite (RF03, issue #88).
 *
 * Nenhuma tela lê turmas ou mocks direto: a tela `/entrar/:codigo` passa por aqui.
 *
 * Sem a API, usa o acervo de `estado-de-turmas.ts`: a matrícula criada aparece na hora
 * para o professor, em `/turmas/:id`, com origem "código de convite". Com a API ligada, a
 * consulta do código vem de `GET /convites/:codigo`, mas a entrada ainda não: ela precisa
 * da sessão do estudante, que depende do login (issues #81 e #84). Esse é o ponto de
 * integração a trocar por `POST /convites/:codigo/matricula` quando a sessão existir.
 */
import { estudanteLogadoMock, professorMock } from '@sgp/mocks';
import type { Estudante, StatusTurma } from '@sgp/shared-types';
import { apiLigada, requisitar } from './api';
import { matriculasNoNavegador, turmasNoNavegador } from './estado-de-turmas';

/** O que a tela mostra antes de o estudante confirmar. */
export interface TurmaDoConvite {
  name: string;
  subject: string;
  term: string;
  teacherName: string;
  status: StatusTurma;
}

export type ResultadoDaEntrada =
  | { tipo: 'matriculado' }
  /** O mesmo código usado de novo: nada muda, a matrícula já existia. */
  | { tipo: 'ja-matriculado' }
  | { tipo: 'recusado'; motivo: string };

/**
 * Quem entra na turma. Na demonstração é o mesmo estudante do histórico (`/estudante`);
 * com o login (#81, #84), passa a ser o estudante da sessão.
 */
export function estudanteDaSessao(): Estudante {
  return estudanteLogadoMock;
}

/** Código como é comparado: sem espaços nas pontas e em maiúsculas, como na API. */
export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase();
}

function turmaDoCodigo(codigo: string) {
  const normalizado = normalizarCodigo(codigo);
  return turmasNoNavegador.find((turma) => turma.inviteCode === normalizado);
}

/** `undefined` quando o código não existe ou foi regenerado. */
export async function consultarConvite(codigo: string): Promise<TurmaDoConvite | undefined> {
  if (apiLigada) {
    try {
      return await requisitar<TurmaDoConvite>(`/convites/${encodeURIComponent(codigo)}`);
    } catch {
      return undefined;
    }
  }

  const turma = turmaDoCodigo(codigo);
  if (!turma) return undefined;
  return {
    name: turma.name,
    subject: turma.subject,
    term: turma.term,
    // Na demonstração, toda turma é do professor de demonstração.
    teacherName: professorMock.fullName,
    status: turma.status,
  };
}

/** `true` quando o estudante já tem matrícula ativa na turma deste código. */
export function jaEstaNaTurma(codigo: string, studentId: string): boolean {
  const turma = turmaDoCodigo(codigo);
  return matriculasNoNavegador.some(
    (matricula) =>
      matricula.classId === turma?.id &&
      matricula.studentId === studentId &&
      matricula.status === 'active',
  );
}

/**
 * Mesmas regras da API (`apps/api/src/convites/regras.ts`): código vigente, turma não
 * arquivada, a segunda entrada não duplica e quem o professor removeu não volta sozinho.
 */
export function entrarPeloConvite(codigo: string, studentId: string): ResultadoDaEntrada {
  if (apiLigada) {
    return {
      tipo: 'recusado',
      motivo:
        'Com a API ligada, entrar pelo convite depende do login do estudante, que ainda não existe.',
    };
  }

  const turma = turmaDoCodigo(codigo);
  if (!turma) {
    return {
      tipo: 'recusado',
      motivo: 'Código inválido ou substituído. Peça o atual ao professor.',
    };
  }
  const existente = matriculasNoNavegador.find(
    (matricula) => matricula.classId === turma.id && matricula.studentId === studentId,
  );
  if (existente?.status === 'active') return { tipo: 'ja-matriculado' };
  if (turma.status === 'archived') {
    return { tipo: 'recusado', motivo: 'Esta turma foi arquivada e não aceita novas matrículas.' };
  }
  if (existente) {
    return {
      tipo: 'recusado',
      motivo: 'Sua matrícula nesta turma foi removida pelo professor. Fale com ele para voltar.',
    };
  }

  matriculasNoNavegador.push({
    id: `matricula-local-${Date.now()}`,
    classId: turma.id,
    studentId,
    enrolledAt: new Date().toISOString(),
    status: 'active',
    enrolledVia: 'invite_code',
  });
  return { tipo: 'matriculado' };
}
