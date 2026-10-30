/**
 * Acesso à API do SGP (`apps/api`).
 *
 * A API só é usada quando `VITE_API_URL` está definida. Sem ela, os módulos `estado-*`
 * seguem no modo de demonstração local (mocks + `localStorage`), que é o que a versão
 * hospedada usa enquanto a API não tem hospedagem.
 *
 * As telas continuam síncronas: cada `estado-*` aplica a alteração na memória na hora e
 * envia a requisição em seguida por `enviarAoServidor`. Se o servidor recusar, o estado
 * é recarregado dele e o professor é avisado, em vez de a tela mostrar algo que não
 * foi gravado.
 */
import { toast } from 'vue-sonner';

const urlDaApi = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') ?? '';

export const apiLigada = urlDaApi !== '';

export async function requisitar<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const resposta = await fetch(`${urlDaApi}${caminho}`, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...opcoes.headers },
  });

  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => null)) as { message?: unknown } | null;
    const mensagem = Array.isArray(corpo?.message) ? corpo.message.join(' ') : corpo?.message;
    throw new Error(typeof mensagem === 'string' ? mensagem : `Erro ${resposta.status}`);
  }

  return (await resposta.json()) as T;
}

/**
 * Gravações saem uma de cada vez, na ordem em que a tela as fez: criar a turma e logo
 * editá-la não pode deixar a edição chegar antes da criação.
 */
let filaDeGravacoes: Promise<unknown> = Promise.resolve();

/** Executa a gravação depois das anteriores e devolve o resultado (ou a falha) dela. */
export function enfileirar<T>(executar: () => Promise<T>): Promise<T> {
  const resultado = filaDeGravacoes.then(executar);
  // A fila segue mesmo que esta gravação falhe; quem trata a falha é quem a pediu.
  filaDeGravacoes = resultado.catch(() => undefined);
  return resultado;
}

/**
 * Envia uma alteração já aplicada na tela. Em caso de falha, avisa e chama `recarregar`
 * para a tela voltar ao que o servidor de fato tem.
 */
export function enviarAoServidor<T>(
  executar: () => Promise<T>,
  recarregar: () => Promise<void>,
  aoConcluir?: (resposta: T) => void,
): void {
  enfileirar(executar)
    .then(aoConcluir)
    .catch((erro: unknown) => {
      toast.error('Não foi possível salvar no servidor', {
        description: erro instanceof Error ? erro.message : undefined,
      });
      void recarregar().catch(() => undefined);
    });
}
