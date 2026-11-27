import type { GabaritoVersaoSnapshot, LayoutVersao, TipoQuestao } from '@sgp/shared-types';

/** O que o gabarito precisa saber de cada questao da prova. */
export interface QuestaoParaGabarito {
  id: string;
  type: TipoQuestao;
  correctAlternativeId: string | null;
  /** Alternativas na ordem de cadastro, usada quando a versao nao embaralhou. */
  alternativeIds: string[];
  /** Pontuacao da questao nesta prova (`questoes_da_prova.score`). */
  score: number;
}

/** A prova mudou depois da geracao e uma questao impressa nao esta mais nela. */
export class GabaritoIndisponivelError extends Error {}

/**
 * Gabarito oficial de uma versao, no formato que o aplicativo guarda (RF08).
 *
 * Segue a folha impressa: as questoes vem de `layout.questionOrder` e as letras de cada
 * objetiva de `layout.alternativeOrder`, ou da ordem de cadastro quando a versao nao
 * embaralhou alternativas. A pontuacao, inclusive a maxima da discursiva, e a da questao
 * nesta prova (pendencia 16).
 */
export function montarGabarito(
  examVersionId: string,
  layout: LayoutVersao,
  questoes: QuestaoParaGabarito[],
  capturedAt: string,
): GabaritoVersaoSnapshot {
  const porId = new Map(questoes.map((questao) => [questao.id, questao]));
  const gabarito: GabaritoVersaoSnapshot = {
    examVersionId,
    capturedAt,
    objectiveQuestions: [],
    discursiveQuestions: [],
  };

  for (const questionId of layout.questionOrder) {
    const questao = porId.get(questionId);
    if (!questao) {
      throw new GabaritoIndisponivelError(
        `A questao ${questionId} da versao ${examVersionId} nao esta mais na prova.`,
      );
    }
    if (questao.type === 'discursiva') {
      gabarito.discursiveQuestions.push({ questionId, maxScore: questao.score });
      continue;
    }
    const impressa = layout.alternativeOrder.find((item) => item.questionId === questionId);
    gabarito.objectiveQuestions.push({
      questionId,
      correctAlternativeId: questao.correctAlternativeId ?? '',
      printedOrder: impressa?.printedOrder ?? questao.alternativeIds,
      score: questao.score,
    });
  }

  return gabarito;
}

/**
 * Compara o que decide a nota: alternativa correta, letras impressas e pontuacao de cada
 * questao. A data de captura e a ordem das questoes na lista nao importam.
 */
export function gabaritosEquivalentes(
  a: GabaritoVersaoSnapshot,
  b: GabaritoVersaoSnapshot,
): boolean {
  const assinatura = (gabarito: GabaritoVersaoSnapshot) =>
    [
      ...gabarito.objectiveQuestions.map(
        (q) => `o|${q.questionId}|${q.correctAlternativeId}|${q.printedOrder.join(',')}|${q.score}`,
      ),
      ...gabarito.discursiveQuestions.map((q) => `d|${q.questionId}|${q.maxScore}`),
    ]
      .sort()
      .join('\n');

  return assinatura(a) === assinatura(b);
}
