/**
 * Estado das correções, compartilhado pela fila de atribuição manual (RF09).
 *
 * Segue o mesmo formato de `estado-de-provas.ts` e `estado-de-turmas.ts`: um módulo
 * único e reativo, não um gerenciador de estado real. Nenhuma tela deve importar
 * `correcoesMock` diretamente para ler ou alterar uma correção.
 *
 * Com a API ligada (`VITE_API_URL`, ver `api.ts`), as correções vêm do servidor por
 * `carregarCorrecoesDoServidor`, chamada antes de montar a aplicação, e atribuir ou
 * desfazer é gravado lá. A regra de duplicidade continua sendo conferida aqui antes, para
 * a tela explicar o motivo na hora; o servidor confere de novo.
 *
 * Sem a API, grava em `localStorage` para sobreviver ao F5 sem virar banco de dados. A
 * chave é versionada; mudar o formato de `Correcao` exige subir o `v`.
 */
import { reactive, watch } from 'vue';
import { correcoesMock } from '@sgp/mocks';
import type { Correcao } from '@sgp/shared-types';
import { apiLigada, enviarAoServidor, requisitar } from './api';

const CHAVE = 'sgp:estado-de-correcoes:v1';

function apartirDosMocks(): Correcao[] {
  return correcoesMock.map((correcao) => ({ ...correcao }));
}

/** Leitura tolerante: qualquer coisa fora do formato esperado volta para os mocks. */
function ler(): Correcao[] {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return apartirDosMocks();

    const lido = JSON.parse(bruto) as unknown;
    return Array.isArray(lido) ? (lido as Correcao[]) : apartirDosMocks();
  } catch {
    // localStorage indisponível (janela privada, cookies bloqueados) ou JSON inválido:
    // a aplicação segue funcionando, só sem sobreviver à recarga.
    return apartirDosMocks();
  }
}

export const correcoesNoNavegador = reactive<Correcao[]>(apiLigada ? [] : ler());

if (!apiLigada) {
  watch(
    correcoesNoNavegador,
    () => {
      try {
        window.localStorage.setItem(CHAVE, JSON.stringify(correcoesNoNavegador));
      } catch {
        // Cota estourada ou armazenamento bloqueado: não vale derrubar a tela por isso.
      }
    },
    { deep: true },
  );
}

/** Substitui as correções pelo que o servidor tem. Só faz sentido com a API ligada. */
export async function carregarCorrecoesDoServidor(): Promise<void> {
  const correcoes = await requisitar<Correcao[]>('/correcoes');
  correcoesNoNavegador.splice(0, correcoesNoNavegador.length, ...correcoes);
}

/** Grava uma alteração já aplicada na memória e sincroniza a correção com a resposta. */
function enviarCorrecao(caminho: string, opcoes: RequestInit): void {
  if (!apiLigada) return;
  enviarAoServidor(
    () => requisitar<Correcao>(caminho, opcoes),
    carregarCorrecoesDoServidor,
    (resposta) => {
      const indice = correcoesNoNavegador.findIndex((correcao) => correcao.id === resposta.id);
      // Troca o objeto inteiro: um campo que o servidor não devolve (ex.: `studentId`
      // depois de desfazer) não pode sobrar da versão anterior.
      if (indice >= 0) correcoesNoNavegador.splice(indice, 1, resposta);
    },
  );
}

export function listarCorrecoes(): Correcao[] {
  return correcoesNoNavegador;
}

/**
 * Correções sem vínculo com aluno: vieram de prova gerada sem identificação, então a
 * nota só entra no histórico depois da atribuição manual (RF09).
 */
export function listarCorrecoesPendentes(): Correcao[] {
  return correcoesNoNavegador.filter((correcao) => !correcao.studentId);
}

export function encontrarCorrecao(id: string): Correcao | undefined {
  return correcoesNoNavegador.find((correcao) => correcao.id === id);
}

/**
 * RF09: a mesma versão não pode ter duas correções atribuídas ao mesmo aluno — seriam
 * duas notas da mesma prova para a mesma pessoa no relatório.
 */
export function alunoJaTemCorrecaoNaVersao(
  examVersionId: string,
  studentId: string,
  ignorandoCorrecaoId?: string,
): boolean {
  return correcoesNoNavegador.some(
    (correcao) =>
      correcao.id !== ignorandoCorrecaoId &&
      correcao.examVersionId === examVersionId &&
      correcao.studentId === studentId,
  );
}

/**
 * Preenche o vínculo na correção existente, sem criar registro novo (RF09) — criar um
 * segundo registro duplicaria a nota em relatório e exportação.
 *
 * Devolve `false` quando a regra de duplicidade impede a atribuição, para a tela poder
 * explicar o motivo em vez de falhar em silêncio.
 */
export function atribuirCorrecao(id: string, studentId: string): boolean {
  const correcao = encontrarCorrecao(id);
  if (!correcao) return false;
  if (alunoJaTemCorrecaoNaVersao(correcao.examVersionId, studentId, id)) return false;

  correcao.studentId = studentId;
  enviarCorrecao(`/correcoes/${id}/atribuir`, {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
  return true;
}

/**
 * Desfaz `atribuirCorrecao`, chamada pela ação "Desfazer" do toast.
 *
 * Existe porque a atribuição é a única forma de a correção sair da fila: sem desfazer,
 * um aluno escolhido por engano não teria mais como ser corrigido pela interface.
 */
export function desfazerAtribuicao(id: string): void {
  const correcao = encontrarCorrecao(id);
  if (!correcao) return;
  delete correcao.studentId;
  enviarCorrecao(`/correcoes/${id}/desfazer-atribuicao`, { method: 'POST' });
}

/** Descarta o que o navegador guardou e volta ao acervo de demonstração. */
export function reiniciarComOsMocks(): void {
  if (apiLigada) {
    void carregarCorrecoesDoServidor();
    return;
  }
  correcoesNoNavegador.splice(0, correcoesNoNavegador.length, ...apartirDosMocks());
}
