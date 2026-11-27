/**
 * Estado local das aplicações, semeado pelos dados demonstrativos da N1.
 * Quando RF05/RF06 tiverem backend, este módulo será o ponto de integração das telas.
 */
import { reactive, watch } from 'vue';
import { aplicacoesMock } from '@sgp/mocks';
import type { Aplicacao } from '@sgp/shared-types';
import { apiLigada, requisitar } from './api';
import { encontrarProva } from './estado-de-provas';

const CHAVE = 'sgp:estado-de-aplicacoes:v1';

function ler(): Aplicacao[] {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return aplicacoesMock.map((aplicacao) => ({ ...aplicacao }));

    const lido = JSON.parse(bruto) as unknown;
    return Array.isArray(lido) ? lido : aplicacoesMock.map((aplicacao) => ({ ...aplicacao }));
  } catch {
    return aplicacoesMock.map((aplicacao) => ({ ...aplicacao }));
  }
}

export const aplicacoesNoNavegador = reactive<Aplicacao[]>(ler());

watch(
  aplicacoesNoNavegador,
  () => {
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(aplicacoesNoNavegador));
    } catch {
      // O estado continua disponível enquanto a sessão estiver aberta.
    }
  },
  { deep: true },
);

export function listarAplicacoes(): Aplicacao[] {
  return aplicacoesNoNavegador;
}

export function listarAplicacoesDaProva(examId: string): Aplicacao[] {
  return aplicacoesNoNavegador.filter((aplicacao) => aplicacao.examId === examId);
}

export async function criarAplicacao(dados: {
  examId: string;
  classId: string;
}): Promise<Aplicacao> {
  const aplicacao = apiLigada
    ? await requisitar<Aplicacao>(`/provas/${dados.examId}/aplicacoes`, {
        method: 'POST',
        body: JSON.stringify({ classId: dados.classId }),
      })
    : {
        id: `aplic-local-${Date.now()}`,
        examId: dados.examId,
        classId: dados.classId,
        teacherId: encontrarProva(dados.examId)?.teacherId ?? 'prof-1',
        status: 'draft' as const,
        createdAt: new Date().toISOString(),
      };
  aplicacoesNoNavegador.unshift(aplicacao);
  return aplicacao;
}
