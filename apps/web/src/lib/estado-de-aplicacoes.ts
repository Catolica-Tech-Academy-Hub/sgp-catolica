/**
 * Estado de aplicações, carregado da API quando ela está ligada e dos mocks/localStorage
 * no modo de demonstração.
 */
import { reactive, watch } from 'vue';
import { aplicacoesMock } from '@sgp/mocks';
import type { Aplicacao } from '@sgp/shared-types';
import { apiLigada, requisitar, requisitarArquivo } from './api';
import { encontrarProva } from './estado-de-provas';
import type { CabecalhoDaProva } from './cabecalhos-da-prova';

const CHAVE = 'sgp:estado-de-aplicacoes:v1';

export interface OpcoesGerarPdf {
  quantity: number;
  shuffleQuestions: boolean;
  shuffleAlternatives: boolean;
  withStudentIdentification: boolean;
  cabecalho: CabecalhoDaProva;
}

interface RespostaGerarPdf {
  application: Aplicacao;
}

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

export const aplicacoesNoNavegador = reactive<Aplicacao[]>(apiLigada ? [] : ler());

if (!apiLigada) {
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
}

export async function carregarAplicacoesDoServidor(): Promise<void> {
  const aplicacoes = await requisitar<Aplicacao[]>('/aplicacoes');
  aplicacoesNoNavegador.splice(0, aplicacoesNoNavegador.length, ...aplicacoes);
}

export async function obterAplicacao(id: string): Promise<Aplicacao> {
  const aplicacao = apiLigada
    ? await requisitar<Aplicacao>(`/aplicacoes/${id}`)
    : aplicacoesNoNavegador.find((item) => item.id === id);
  if (!aplicacao) throw new Error('Aplicacao nao encontrada.');

  const indice = aplicacoesNoNavegador.findIndex((item) => item.id === id);
  if (indice >= 0) aplicacoesNoNavegador[indice] = aplicacao;
  else aplicacoesNoNavegador.unshift(aplicacao);
  return aplicacao;
}

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
    ? await requisitar<Aplicacao>('/aplicacoes', {
        method: 'POST',
        body: JSON.stringify(dados),
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

export async function gerarPdfDaAplicacao(id: string, dados: OpcoesGerarPdf): Promise<Blob> {
  if (!apiLigada) {
    throw new Error('Configure VITE_API_URL para gerar e baixar o PDF.');
  }

  const resultado = await requisitar<RespostaGerarPdf>(`/aplicacoes/${id}/gerar-pdf`, {
    method: 'POST',
    body: JSON.stringify(dados),
  });
  const indice = aplicacoesNoNavegador.findIndex((item) => item.id === id);
  if (indice >= 0) aplicacoesNoNavegador[indice] = resultado.application;
  else aplicacoesNoNavegador.unshift(resultado.application);

  return requisitarArquivo(`/aplicacoes/${id}/pdf`);
}

export function baixarPdfDaAplicacao(id: string): Promise<Blob> {
  if (!apiLigada) {
    throw new Error('Configure VITE_API_URL para baixar o PDF.');
  }
  return requisitarArquivo(`/aplicacoes/${id}/pdf`);
}
