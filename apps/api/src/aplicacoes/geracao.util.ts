import { randomInt } from 'node:crypto';
import type { LayoutVersao } from '@sgp/shared-types';

type EscolherIndice = (limite: number) => number;

interface QuestaoParaGeracao {
  questionId: string;
  type: 'objetiva' | 'discursiva';
  alternativeIds: string[];
}

function escolherIndiceAleatorio(limite: number): number {
  return randomInt(limite);
}

export function embaralhar<T>(
  itens: readonly T[],
  escolherIndice: EscolherIndice = escolherIndiceAleatorio,
): T[] {
  const resultado = [...itens];
  for (let indice = resultado.length - 1; indice > 0; indice -= 1) {
    const outroIndice = escolherIndice(indice + 1);
    [resultado[indice], resultado[outroIndice]] = [resultado[outroIndice], resultado[indice]];
  }
  return resultado;
}

export function criarLayoutVersao(
  questoes: readonly QuestaoParaGeracao[],
  embaralharQuestoes: boolean,
  embaralharAlternativas: boolean,
  escolherIndice: EscolherIndice = escolherIndiceAleatorio,
): LayoutVersao {
  const ordemDasQuestoes = embaralharQuestoes
    ? embaralhar(questoes, escolherIndice)
    : [...questoes];

  return {
    questionOrder: ordemDasQuestoes.map((questao) => questao.questionId),
    alternativeOrder: ordemDasQuestoes
      .filter((questao) => questao.type === 'objetiva')
      .map((questao) => ({
        questionId: questao.questionId,
        printedOrder: embaralharAlternativas
          ? embaralhar(questao.alternativeIds, escolherIndice)
          : [...questao.alternativeIds],
      })),
  };
}

export function distribuirEstudantes(
  idsDosEstudantes: readonly string[],
  idsDasVersoes: readonly string[],
  escolherIndice: EscolherIndice = escolherIndiceAleatorio,
): Array<{ studentId: string; examVersionId: string }> {
  if (idsDosEstudantes.length === 0) return [];
  if (idsDasVersoes.length === 0) throw new Error('É necessário gerar ao menos uma versão.');

  const versoesEmOrdemAleatoria = embaralhar(idsDasVersoes, escolherIndice);
  return embaralhar(idsDosEstudantes, escolherIndice).map((studentId, indice) => ({
    studentId,
    examVersionId: versoesEmOrdemAleatoria[indice % versoesEmOrdemAleatoria.length],
  }));
}
