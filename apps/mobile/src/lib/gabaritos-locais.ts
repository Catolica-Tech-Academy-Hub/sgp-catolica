import type { GabaritoVersaoSnapshot, LayoutVersao } from '@sgp/shared-types';
import type { ArmazenamentoDaFila } from './fila-persistente';

/**
 * Copia local dos gabaritos por versao (RF08, RNF06, issue #96).
 *
 * Guarda o gabarito mais recente de cada versao para corrigir sem sinal. E diferente do
 * `answerKeySnapshot` de um item da fila, que registra o gabarito usado naquela correcao e
 * nunca muda. Cada versao tem uma chave propria, entao um dado corrompido nao afeta as
 * outras. O armazenamento entra por parametro, e nada aqui acessa a rede.
 */

/** Prefixo proprio: as chaves nunca se misturam com as da fila de correcoes. */
const PREFIXO_DOS_GABARITOS = '@sgp/gabaritos/v1/';
/** RF02: questao objetiva tem de 2 a 5 alternativas. */
const MINIMO_DE_ALTERNATIVAS = 2;
const MAXIMO_DE_ALTERNATIVAS = 5;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export type ResultadoAoSalvarGabarito =
  | 'salvo'
  /** Ja existe uma copia igual ou mais recente desta versao, que foi mantida. */
  | 'mantido'
  | 'invalido';

export interface GabaritosCarregados {
  /** Ordenados por `examVersionId`. */
  gabaritos: GabaritoVersaoSnapshot[];
  /** Chaves que nao puderam ser lidas. Sao mantidas no aparelho, nunca apagadas aqui. */
  chavesIlegiveis: string[];
}

export interface GabaritosLocais {
  salvar(gabarito: GabaritoVersaoSnapshot): Promise<ResultadoAoSalvarGabarito>;
  carregar(examVersionId: string): Promise<GabaritoVersaoSnapshot | undefined>;
  listar(): Promise<GabaritosCarregados>;
}

function chaveDaVersao(examVersionId: string): string {
  return `${PREFIXO_DOS_GABARITOS}${examVersionId}`;
}

function eObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function textoPreenchido(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length > 0;
}

function pontuacaoValida(valor: unknown): boolean {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0;
}

/** Confere o calendario porque `Date.parse` transforma 31/02 em 03/03 sem avisar. */
function dataValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !DATA_ISO.test(valor)) return false;
  if (!Number.isFinite(Date.parse(valor))) return false;

  const [ano, mes, dia] = valor.slice(0, 10).split('-').map(Number);
  const noCalendario = new Date(Date.UTC(ano, mes - 1, dia));
  return noCalendario.getUTCMonth() === mes - 1 && noCalendario.getUTCDate() === dia;
}

function objetivaValida(valor: unknown): boolean {
  if (!eObjeto(valor) || !Array.isArray(valor.printedOrder)) return false;
  const ordem: unknown[] = valor.printedOrder;
  return (
    textoPreenchido(valor.questionId) &&
    textoPreenchido(valor.correctAlternativeId) &&
    pontuacaoValida(valor.score) &&
    ordem.length >= MINIMO_DE_ALTERNATIVAS &&
    ordem.length <= MAXIMO_DE_ALTERNATIVAS &&
    ordem.every(textoPreenchido) &&
    new Set(ordem).size === ordem.length &&
    ordem.includes(valor.correctAlternativeId)
  );
}

function discursivaValida(valor: unknown): boolean {
  return eObjeto(valor) && textoPreenchido(valor.questionId) && pontuacaoValida(valor.maxScore);
}

/** Um gabarito incompleto calcularia a nota errada, entao nao e aceito nem lido. */
export function gabaritoValido(valor: unknown): valor is GabaritoVersaoSnapshot {
  if (!eObjeto(valor)) return false;
  const { examVersionId, capturedAt, objectiveQuestions, discursiveQuestions } = valor;
  if (!textoPreenchido(examVersionId) || !dataValida(capturedAt)) return false;
  if (!Array.isArray(objectiveQuestions) || !Array.isArray(discursiveQuestions)) return false;
  if (objectiveQuestions.length + discursiveQuestions.length === 0) return false;
  if (!objectiveQuestions.every(objetivaValida)) return false;
  if (!discursiveQuestions.every(discursivaValida)) return false;

  const questoes = [...objectiveQuestions, ...discursiveQuestions].map((q) => q.questionId);
  return new Set(questoes).size === questoes.length;
}

/**
 * Confere o gabarito com a folha impressa: as questoes precisam ser as mesmas e a ordem das
 * alternativas, quando o layout a registra, igual. Sem isso uma letra marcada na folha
 * seria traduzida para a alternativa errada.
 */
export function gabaritoCompativelComLayout(
  gabarito: GabaritoVersaoSnapshot,
  layout: LayoutVersao,
): boolean {
  const impressas = new Set(layout.questionOrder);
  const questoes = [...gabarito.objectiveQuestions, ...gabarito.discursiveQuestions];
  if (questoes.length !== impressas.size) return false;
  if (!questoes.every((questao) => impressas.has(questao.questionId))) return false;

  return gabarito.objectiveQuestions.every((questao) => {
    const ordem = layout.alternativeOrder.find(
      (item) => item.questionId === questao.questionId,
    )?.printedOrder;
    return (
      !ordem ||
      (ordem.length === questao.printedOrder.length &&
        ordem.every((id, indice) => id === questao.printedOrder[indice]))
    );
  });
}

function lerGabarito(chave: string, conteudo: string | null): GabaritoVersaoSnapshot | undefined {
  if (conteudo === null) return undefined;
  try {
    const gabarito: unknown = JSON.parse(conteudo);
    return gabaritoValido(gabarito) && chaveDaVersao(gabarito.examVersionId) === chave
      ? gabarito
      : undefined;
  } catch {
    return undefined;
  }
}

export function criarGabaritosLocais(armazenamento: ArmazenamentoDaFila): GabaritosLocais {
  async function carregar(examVersionId: string) {
    const chave = chaveDaVersao(examVersionId);
    const [par] = await armazenamento.multiGet([chave]);
    return par ? lerGabarito(chave, par[1]) : undefined;
  }

  async function gravar(gabarito: GabaritoVersaoSnapshot): Promise<ResultadoAoSalvarGabarito> {
    if (!gabaritoValido(gabarito)) return 'invalido';

    // Copia atual corrompida vem como ausente e pode ser substituida por uma valida.
    const atual = await carregar(gabarito.examVersionId);
    if (atual && Date.parse(atual.capturedAt) >= Date.parse(gabarito.capturedAt)) return 'mantido';

    await armazenamento.setItem(chaveDaVersao(gabarito.examVersionId), JSON.stringify(gabarito));
    return 'salvo';
  }

  // Comparar e gravar nao e atomico: em serie, uma copia antiga nao vence uma mais nova.
  let ultimaGravacao: Promise<unknown> = Promise.resolve();

  return {
    salvar(gabarito) {
      const gravacao = ultimaGravacao.then(() => gravar(gabarito));
      ultimaGravacao = gravacao.catch(() => undefined);
      return gravacao;
    },

    carregar,

    async listar() {
      const todas = await armazenamento.getAllKeys();
      const chaves = todas.filter((chave) => chave.startsWith(PREFIXO_DOS_GABARITOS));
      if (chaves.length === 0) return { gabaritos: [], chavesIlegiveis: [] };

      const gabaritos: GabaritoVersaoSnapshot[] = [];
      const chavesIlegiveis: string[] = [];
      for (const [chave, conteudo] of await armazenamento.multiGet(chaves)) {
        const gabarito = lerGabarito(chave, conteudo);
        if (gabarito) gabaritos.push(gabarito);
        else chavesIlegiveis.push(chave);
      }
      gabaritos.sort((a, b) => (a.examVersionId < b.examVersionId ? -1 : 1));
      return { gabaritos, chavesIlegiveis };
    },
  };
}
