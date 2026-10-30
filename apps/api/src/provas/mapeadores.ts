import type { Prova } from '@sgp/shared-types';
import type {
  Prova as ProvaDoBanco,
  QuestaoDaProva as QuestaoDaProvaDoBanco,
} from '../generated/prisma/client';

/** Prova do dominio mais o layout do editor, quando a web ja gravou um. */
export type ProvaComBlocos = Prova & { blocos?: unknown[] };

export type ProvaComQuestoes = ProvaDoBanco & { questoes: QuestaoDaProvaDoBanco[] };

export const incluirQuestoes = {
  questoes: { orderBy: { order: 'asc' } },
} as const;

export function paraProva(prova: ProvaComQuestoes): ProvaComBlocos {
  const base: ProvaComBlocos = {
    id: prova.id,
    teacherId: prova.teacherId,
    title: prova.title,
    questions: prova.questoes.map(({ questionId, order, score }) => ({
      questionId,
      order,
      score: Number(score),
    })),
    status: prova.status,
    createdAt: prova.createdAt.toISOString(),
  };

  if (prova.description !== null) base.description = prova.description;
  if (Array.isArray(prova.blocos)) base.blocos = prova.blocos;

  return base;
}
