import type { ItemFilaCorrecao } from '@sgp/shared-types';

/**
 * Envio da fila de correcoes para a API (RF08, issue #99): `POST /correcoes/lote`.
 *
 * A API responde 200 mesmo com itens em erro; o resultado de cada um vem na resposta.
 * Como o identificador da correcao e gerado no aparelho (`clientCorrectionId`), reenviar o
 * mesmo item e seguro: o servidor reconhece e nao duplica.
 */

/** Variavel inlinada pelo Expo no build (`EXPO_PUBLIC_*`); o tipo do Node nao existe no app. */
declare const process: { env: Record<string, string | undefined> };

/** A instancia gratuita do Render hiberna; a primeira chamada leva cerca de um minuto. */
const TEMPO_LIMITE_EM_MS = 90_000;

export interface ResultadoDoItem {
  clientCorrectionId?: string;
  syncStatus: 'synced' | 'error';
  syncError?: string;
}

/** O subconjunto do `fetch` que a sincronizacao usa, para os testes nao tocarem a rede. */
export type Requisitar = (
  url: string,
  opcoes: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type RespostaDaSincronizacao =
  | { ok: true; resultados: ResultadoDoItem[] }
  | { ok: false; motivo: 'sem_api' | 'sem_conexao' | 'recusado'; detalhe?: string };

/** Endereco da API: so existe quando o aplicativo foi iniciado com `EXPO_PUBLIC_API_URL`. */
export function urlDaApi(): string | undefined {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  return url ? url : undefined;
}

function lerResultados(corpo: unknown): ResultadoDoItem[] | undefined {
  if (typeof corpo !== 'object' || corpo === null) return undefined;
  const { resultados } = corpo as { resultados?: unknown };
  if (!Array.isArray(resultados)) return undefined;
  return resultados.filter(
    (item): item is ResultadoDoItem =>
      typeof item === 'object' &&
      item !== null &&
      ((item as ResultadoDoItem).syncStatus === 'synced' ||
        (item as ResultadoDoItem).syncStatus === 'error'),
  );
}

export async function enviarLote(
  itens: ItemFilaCorrecao[],
  opcoes: { url?: string; requisitar?: Requisitar } = {},
): Promise<RespostaDaSincronizacao> {
  const url = opcoes.url ?? urlDaApi();
  if (!url) return { ok: false, motivo: 'sem_api' };

  const requisitar: Requisitar = opcoes.requisitar ?? ((u, o) => fetch(u, o));
  const controle = new AbortController();
  const temporizador = setTimeout(() => controle.abort(), TEMPO_LIMITE_EM_MS);
  try {
    const resposta = await requisitar(`${url}/correcoes/lote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itens }),
      signal: controle.signal,
    });
    if (!resposta.ok) return { ok: false, motivo: 'recusado', detalhe: `HTTP ${resposta.status}` };
    const resultados = lerResultados(await resposta.json());
    if (!resultados) return { ok: false, motivo: 'recusado', detalhe: 'Resposta inesperada.' };
    return { ok: true, resultados };
  } catch {
    return { ok: false, motivo: 'sem_conexao' };
  } finally {
    clearTimeout(temporizador);
  }
}
