import type { GabaritoVersaoSnapshot, LayoutVersao } from '@sgp/shared-types';
import type { Prisma } from '../generated/prisma/client';
import { type QuestaoParaGabarito, montarGabarito } from './gabarito';

/** O que carregar da prova para montar o gabarito das versoes. */
export const incluirProvaParaGabarito = {
  questoes: {
    include: { questao: { include: { alternativas: { orderBy: { position: 'asc' } } } } },
  },
} as const;

type ProvaParaGabarito = Prisma.ProvaGetPayload<{ include: typeof incluirProvaParaGabarito }>;

export function questoesParaGabarito(prova: ProvaParaGabarito): QuestaoParaGabarito[] {
  return prova.questoes.map(({ questao, score }) => ({
    id: questao.id,
    type: questao.type,
    correctAlternativeId: questao.correctAlternativeId,
    alternativeIds: questao.alternativas.map((alternativa) => alternativa.id),
    score: Number(score),
  }));
}

/** Gabarito oficial atual de uma versao gravada no banco. */
export function gabaritoDaVersao(
  versao: { id: string; layout: Prisma.JsonValue },
  questoes: QuestaoParaGabarito[],
  capturedAt: Date,
): GabaritoVersaoSnapshot {
  return montarGabarito(
    versao.id,
    versao.layout as unknown as LayoutVersao,
    questoes,
    capturedAt.toISOString(),
  );
}
