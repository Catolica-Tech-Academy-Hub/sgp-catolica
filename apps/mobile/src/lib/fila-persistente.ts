import type { ItemFilaCorrecao } from '@sgp/shared-types';

/**
 * Persistencia da fila de correcoes no aparelho (RF08, RNF06, issue #99).
 *
 * Cada correcao fica em uma chave propria: gravar um item nunca reescreve os outros, e um
 * item corrompido nao impede a leitura dos demais. O armazenamento entra por parametro,
 * para as regras serem testadas sem o runtime do aparelho. Nada aqui envia dados a rede.
 */

/** Versao no prefixo: um formato futuro pode conviver com os itens ja gravados. */
const PREFIXO_DA_FILA = '@sgp/fila-correcoes/v1/';
const STATUS_VALIDOS = ['pending', 'synced', 'error'];

/** O subconjunto do AsyncStorage que a fila usa. */
export interface ArmazenamentoDaFila {
  getAllKeys(): Promise<readonly string[]>;
  multiGet(chaves: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
  setItem(chave: string, valor: string): Promise<void>;
}

export interface FilaCarregada {
  itens: ItemFilaCorrecao[];
  /** Chaves que nao puderam ser lidas. Sao mantidas no aparelho, nunca apagadas aqui. */
  chavesIlegiveis: string[];
}

export interface FilaPersistente {
  salvar(item: ItemFilaCorrecao): Promise<void>;
  carregar(): Promise<FilaCarregada>;
}

function chaveDoItem(clientCorrectionId: string): string {
  return `${PREFIXO_DA_FILA}${clientCorrectionId}`;
}

function eObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Sem o snapshot do gabarito o item nao pode ser recalculado, entao nao e aceito (RF08). */
function itemValido(valor: unknown): valor is ItemFilaCorrecao {
  if (!eObjeto(valor) || !eObjeto(valor.answerKeySnapshot)) return false;
  const snapshot = valor.answerKeySnapshot;
  return (
    typeof valor.clientCorrectionId === 'string' &&
    valor.clientCorrectionId.length > 0 &&
    typeof valor.examVersionId === 'string' &&
    typeof valor.capturedAt === 'string' &&
    STATUS_VALIDOS.includes(valor.syncStatus as string) &&
    Array.isArray(valor.objectiveAnswers) &&
    Array.isArray(valor.discursiveScores) &&
    snapshot.examVersionId === valor.examVersionId &&
    Array.isArray(snapshot.objectiveQuestions) &&
    Array.isArray(snapshot.discursiveQuestions)
  );
}

function lerItem(chave: string, conteudo: string | null): ItemFilaCorrecao | undefined {
  if (conteudo === null) return undefined;
  try {
    const item: unknown = JSON.parse(conteudo);
    return itemValido(item) && chaveDoItem(item.clientCorrectionId) === chave ? item : undefined;
  } catch {
    return undefined;
  }
}

export function criarFilaPersistente(armazenamento: ArmazenamentoDaFila): FilaPersistente {
  return {
    salvar: (item) =>
      armazenamento.setItem(chaveDoItem(item.clientCorrectionId), JSON.stringify(item)),

    async carregar() {
      const todas = await armazenamento.getAllKeys();
      const chaves = todas.filter((chave) => chave.startsWith(PREFIXO_DA_FILA));
      if (chaves.length === 0) return { itens: [], chavesIlegiveis: [] };

      const itens: ItemFilaCorrecao[] = [];
      const chavesIlegiveis: string[] = [];
      for (const [chave, conteudo] of await armazenamento.multiGet(chaves)) {
        const item = lerItem(chave, conteudo);
        if (item) itens.push(item);
        else chavesIlegiveis.push(chave);
      }
      return { itens, chavesIlegiveis };
    },
  };
}

/**
 * Junta os itens de demonstracao com os salvos, uma vez por `clientCorrectionId`. Os mocks
 * nunca sao gravados; se um item salvo tiver o mesmo identificador, vale o salvo.
 */
export function mesclarComMocks(
  mocks: readonly ItemFilaCorrecao[],
  salvos: readonly ItemFilaCorrecao[],
): ItemFilaCorrecao[] {
  const porId = new Map<string, ItemFilaCorrecao>();
  for (const item of mocks) porId.set(item.clientCorrectionId, { ...item });
  for (const item of salvos) porId.set(item.clientCorrectionId, item);
  return [...porId.values()];
}
