/**
 * Estado das correções, compartilhado pela fila de atribuição manual (RF09).
 *
 * Segue o mesmo formato de `estado-de-provas.ts` e `estado-de-turmas.ts`: um módulo
 * único e reativo, não um gerenciador de estado real. Quando o backend existir, este
 * arquivo é o ponto de integração a substituir por chamadas à API — nenhuma tela deve
 * importar `correcoesMock` diretamente para ler ou alterar uma correção.
 *
 * Grava em `localStorage` para sobreviver ao F5 sem virar banco de dados. A chave é
 * versionada; mudar o formato de `Correcao` exige subir o `v`.
 */
import { reactive, watch } from 'vue';
import { correcoesMock } from '@sgp/mocks';
import type { Correcao } from '@sgp/shared-types';

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

export const correcoesNoNavegador = reactive<Correcao[]>(ler());

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
  if (correcao) delete correcao.studentId;
}

/** Descarta o que o navegador guardou e volta ao acervo de demonstração. */
export function reiniciarComOsMocks(): void {
  correcoesNoNavegador.splice(0, correcoesNoNavegador.length, ...apartirDosMocks());
}
