import type { Questao } from '@sgp/shared-types';
import type {
  Alternativa as AlternativaDoBanco,
  Questao as QuestaoDoBanco,
} from '../generated/prisma/client';

export type QuestaoComAlternativas = QuestaoDoBanco & { alternativas: AlternativaDoBanco[] };

/** Ordem das alternativas: a de cadastro (`position`), a mesma em que o professor as escreveu. */
export const incluirAlternativas = {
  alternativas: { orderBy: { position: 'asc' } },
} as const;

export function paraQuestao(questao: QuestaoComAlternativas): Questao {
  const base: Questao = {
    id: questao.id,
    teacherId: questao.teacherId,
    type: questao.type,
    statement: questao.statement,
    tags: questao.tags as string[],
  };

  if (questao.type === 'objetiva') {
    base.alternatives = questao.alternativas.map(({ id, text }) => ({ id, text }));
    base.correctAlternativeId = questao.correctAlternativeId ?? undefined;
  } else if (questao.maxScore !== null) {
    base.maxScore = Number(questao.maxScore);
  }

  if (questao.deletedAt) base.deletedAt = questao.deletedAt.toISOString();

  return base;
}
