import type {
  GabaritoVersaoSnapshot,
  ItemFilaCorrecao,
  NotaDiscursiva,
  ResultadoObjetivo,
} from '@sgp/shared-types';

/** Limite dos campos que viram colunas de texto (ver `schema.prisma`). */
const MAXIMO_ID = 64;
const MAXIMO_NOME = 160;
const MAXIMO_MATRICULA = 32;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export type Leitura<T> = { ok: true; valor: T } | { ok: false; motivo: string };

function eObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown, maximo: number): valor is string {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= maximo;
}

function opcional(valor: unknown, maximo: number): boolean {
  return valor === undefined || texto(valor, maximo);
}

function pontuacao(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0;
}

function data(valor: unknown): valor is string {
  return typeof valor === 'string' && DATA_ISO.test(valor) && !Number.isNaN(Date.parse(valor));
}

function repetidos(ids: string[]): boolean {
  return new Set(ids).size !== ids.length;
}

function lerSnapshot(valor: unknown): GabaritoVersaoSnapshot | undefined {
  if (!eObjeto(valor) || !texto(valor.examVersionId, MAXIMO_ID) || !data(valor.capturedAt)) {
    return undefined;
  }
  const { objectiveQuestions, discursiveQuestions } = valor;
  if (!Array.isArray(objectiveQuestions) || !Array.isArray(discursiveQuestions)) return undefined;

  const objetivasValidas = objectiveQuestions.every(
    (q: unknown) =>
      eObjeto(q) &&
      texto(q.questionId, MAXIMO_ID) &&
      texto(q.correctAlternativeId, MAXIMO_ID) &&
      pontuacao(q.score) &&
      Array.isArray(q.printedOrder) &&
      q.printedOrder.length > 0 &&
      q.printedOrder.every((id: unknown) => texto(id, MAXIMO_ID)) &&
      !repetidos(q.printedOrder as string[]) &&
      q.printedOrder.includes(q.correctAlternativeId),
  );
  const discursivasValidas = discursiveQuestions.every(
    (q: unknown) => eObjeto(q) && texto(q.questionId, MAXIMO_ID) && pontuacao(q.maxScore),
  );
  if (!objetivasValidas || !discursivasValidas) return undefined;

  const gabarito = valor as unknown as GabaritoVersaoSnapshot;
  const questoes = [...gabarito.objectiveQuestions, ...gabarito.discursiveQuestions];
  if (questoes.length === 0 || repetidos(questoes.map((q) => q.questionId))) return undefined;
  return gabarito;
}

/**
 * Le um item do lote vindo do aplicativo. Um item malformado vira erro so dele, para os
 * outros do mesmo lote sincronizarem (RF08: status por item).
 */
export function lerItem(valor: unknown): Leitura<ItemFilaCorrecao> {
  if (!eObjeto(valor) || !texto(valor.clientCorrectionId, MAXIMO_ID)) {
    return { ok: false, motivo: 'Item sem clientCorrectionId valido.' };
  }
  if (!texto(valor.examVersionId, MAXIMO_ID) || !data(valor.capturedAt)) {
    return { ok: false, motivo: 'Item sem versao ou data de captura valida.' };
  }
  if (
    !opcional(valor.studentId, MAXIMO_ID) ||
    !opcional(valor.reportedStudentName, MAXIMO_NOME) ||
    !opcional(valor.reportedStudentRegistration, MAXIMO_MATRICULA)
  ) {
    return { ok: false, motivo: 'Identificacao do estudante invalida.' };
  }
  const { objectiveAnswers, discursiveScores } = valor;
  const respostasValidas =
    Array.isArray(objectiveAnswers) &&
    objectiveAnswers.every(
      (r: unknown) =>
        eObjeto(r) && texto(r.questionId, MAXIMO_ID) && texto(r.selectedAlternativeId, MAXIMO_ID),
    );
  const notasValidas =
    Array.isArray(discursiveScores) &&
    discursiveScores.every(
      (n: unknown) => eObjeto(n) && texto(n.questionId, MAXIMO_ID) && pontuacao(n.score),
    );
  if (!respostasValidas || !notasValidas) {
    return { ok: false, motivo: 'Respostas objetivas ou notas discursivas invalidas.' };
  }

  const snapshot = lerSnapshot(valor.answerKeySnapshot);
  if (!snapshot) return { ok: false, motivo: 'Item sem copia valida do gabarito.' };
  if (snapshot.examVersionId !== valor.examVersionId) {
    return { ok: false, motivo: 'A copia do gabarito e de outra versao.' };
  }

  return { ok: true, valor: valor as unknown as ItemFilaCorrecao };
}

export interface NotaCalculada {
  objectiveResults: ResultadoObjetivo[];
  discursiveScores: NotaDiscursiva[];
  totalScore: number;
}

/** Duas casas, como a coluna `totalScore` (DECIMAL(6,2)). */
function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Nota do item calculada pelo gabarito que o aplicativo usou (`answerKeySnapshot`), nunca
 * pelo gabarito atual: se o oficial mudou, a nota continua sendo a da folha corrigida e o
 * professor e sinalizado a parte (RF08).
 *
 * Objetiva sem resposta conta como errada. Toda discursiva do gabarito precisa de nota,
 * entre zero e a pontuacao maxima.
 */
export function calcularNota(item: ItemFilaCorrecao): Leitura<NotaCalculada> {
  const gabarito = item.answerKeySnapshot;
  const objetivas = new Map(gabarito.objectiveQuestions.map((q) => [q.questionId, q]));
  const discursivas = new Map(gabarito.discursiveQuestions.map((q) => [q.questionId, q]));

  const respostas = new Map<string, string>();
  for (const resposta of item.objectiveAnswers) {
    const questao = objetivas.get(resposta.questionId);
    if (!questao || respostas.has(resposta.questionId)) {
      return { ok: false, motivo: `Resposta invalida para a questao ${resposta.questionId}.` };
    }
    if (!questao.printedOrder.includes(resposta.selectedAlternativeId)) {
      return {
        ok: false,
        motivo: `A alternativa marcada na questao ${resposta.questionId} nao existe na versao.`,
      };
    }
    respostas.set(resposta.questionId, resposta.selectedAlternativeId);
  }

  const notas = new Map<string, number>();
  for (const nota of item.discursiveScores) {
    const questao = discursivas.get(nota.questionId);
    if (!questao || notas.has(nota.questionId)) {
      return { ok: false, motivo: `Nota invalida para a questao ${nota.questionId}.` };
    }
    if (nota.score > questao.maxScore) {
      return {
        ok: false,
        motivo: `A nota da questao ${nota.questionId} passa da pontuacao maxima.`,
      };
    }
    notas.set(nota.questionId, nota.score);
  }
  const semNota = gabarito.discursiveQuestions.find((q) => !notas.has(q.questionId));
  if (semNota) {
    return { ok: false, motivo: `Falta a nota da questao discursiva ${semNota.questionId}.` };
  }

  const objectiveResults = gabarito.objectiveQuestions.map((questao) => {
    const correct = respostas.get(questao.questionId) === questao.correctAlternativeId;
    return { questionId: questao.questionId, correct, score: correct ? questao.score : 0 };
  });
  const discursiveScores = gabarito.discursiveQuestions.map((questao) => ({
    questionId: questao.questionId,
    score: notas.get(questao.questionId) ?? 0,
  }));
  const totalScore = arredondar(
    [...objectiveResults, ...discursiveScores].reduce((soma, q) => soma + q.score, 0),
  );

  return { ok: true, valor: { objectiveResults, discursiveScores, totalScore } };
}
