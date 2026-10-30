/**
 * Estado do acervo de provas, compartilhado entre `/provas` e `/provas/:id`.
 *
 * Não é um gerenciador de estado real: é um módulo único e reativo que existe só
 * para a navegação entre as duas telas não perder o que foi criado. Nenhuma tela deve
 * importar `@sgp/mocks` diretamente para ler ou criar uma prova; deve passar por aqui.
 *
 * ## Com a API ligada
 *
 * Com `VITE_API_URL` (ver `api.ts`), as provas e os blocos do editor vêm do servidor
 * por `carregarProvasDoServidor`, chamada antes de montar a aplicação (RF04). O editor
 * altera a prova a cada tecla, então a gravação não acompanha cada mudança: depois de
 * uma pausa curta, só as provas que mudaram desde o último envio vão para a API.
 *
 * ## Sem a API: por que grava no navegador
 *
 * Só em memória, uma prova criada desaparecia a cada recarga da página: abrir o
 * editor, atualizar e cair em "Prova não encontrada" — inclusive no recarregamento
 * automático do Vite durante o desenvolvimento. Para demonstrar o produto ao cliente
 * isso inviabiliza o fluxo mais básico, criar uma prova e voltar a ela.
 *
 * `localStorage` resolve sem violar o escopo da N1: não é banco de dados, não é
 * backend e não há requisição de rede — é o mesmo estado da sessão, só que
 * sobrevivendo ao F5. Os dados continuam vindo de `@sgp/mocks`, que semeiam o
 * primeiro acesso.
 *
 * A chave é versionada: mudar o formato de `Prova` ou dos blocos exige subir o `v`,
 * senão o navegador de quem já usou a aplicação continuaria lendo o formato antigo.
 * Pelo mesmo motivo, alterações em `packages/mocks` não aparecem para quem já tem
 * estado gravado — use `reiniciarComOsMocks()` ou suba a versão da chave.
 */
import { reactive, watch } from 'vue';
import { provasMock } from '@sgp/mocks';
import type { Prova } from '@sgp/shared-types';
import { apiLigada, enviarAoServidor, requisitar } from './api';
import {
  type BlocoDaProva,
  blocosIniciaisApartirDeProva,
  questoesParaProva,
} from './blocos-da-prova';

const CHAVE = 'sgp:estado-de-provas:v1';

interface EstadoGravado {
  provas: Prova[];
  blocos: Record<string, BlocoDaProva[]>;
}

function apartirDosMocks(): EstadoGravado {
  return {
    provas: provasMock.map((prova) => ({ ...prova, questions: [...prova.questions] })),
    blocos: {},
  };
}

/** Leitura tolerante: qualquer coisa fora do formato esperado volta para os mocks. */
function ler(): EstadoGravado {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return apartirDosMocks();

    const lido = JSON.parse(bruto) as Partial<EstadoGravado>;
    if (!Array.isArray(lido.provas)) return apartirDosMocks();

    return {
      provas: lido.provas,
      blocos: lido.blocos && typeof lido.blocos === 'object' ? lido.blocos : {},
    };
  } catch {
    // localStorage indisponível (janela privada, cookies bloqueados) ou JSON inválido:
    // a aplicação segue funcionando, só sem sobreviver à recarga.
    return apartirDosMocks();
  }
}

// Com a API ligada, tudo começa vazio e é preenchido pelo servidor.
const inicial: EstadoGravado = apiLigada ? { provas: [], blocos: {} } : ler();

export const provasNoNavegador = reactive<Prova[]>(inicial.provas);

const blocosPorProva = reactive<Record<string, BlocoDaProva[]>>(inicial.blocos);

function gravar(): void {
  try {
    window.localStorage.setItem(
      CHAVE,
      JSON.stringify({ provas: provasNoNavegador, blocos: blocosPorProva }),
    );
  } catch {
    // Cota estourada ou armazenamento bloqueado: não vale derrubar a tela por isso.
  }
}

/** Prova como a API devolve: o domínio mais o layout do editor, se já foi gravado. */
type ProvaDoServidor = Prova & { blocos?: BlocoDaProva[] };

/** Último conteúdo enviado de cada prova, para só reenviar o que mudou. */
const ultimoEnvio = new Map<string, string>();

function conteudoParaEnvio(prova: Prova): string {
  const { title, description, status, questions } = prova;
  return JSON.stringify({
    title,
    description,
    status,
    questions,
    blocos: blocosPorProva[prova.id],
  });
}

/** Substitui o acervo pelo que o servidor tem. Só faz sentido com a API ligada. */
export async function carregarProvasDoServidor(): Promise<void> {
  const doServidor = await requisitar<ProvaDoServidor[]>('/provas');
  for (const id of Object.keys(blocosPorProva)) delete blocosPorProva[id];
  ultimoEnvio.clear();

  const provas = doServidor.map(({ blocos, ...prova }) => {
    if (blocos) {
      blocosPorProva[prova.id] = blocos;
      // Questão rascunho só existe nos blocos: a lista de questões segue o que o
      // professor vê no editor, não só o que já está no banco.
      prova.questions = questoesParaProva(blocos);
    }
    ultimoEnvio.set(prova.id, conteudoParaEnvio(prova));
    return prova;
  });
  provasNoNavegador.splice(0, provasNoNavegador.length, ...provas);
}

let envioAgendado: number | undefined;

function enviarProvasAlteradas(): void {
  envioAgendado = undefined;
  for (const prova of provasNoNavegador) {
    const conteudo = conteudoParaEnvio(prova);
    if (ultimoEnvio.get(prova.id) === conteudo) continue;
    ultimoEnvio.set(prova.id, conteudo);
    enviarAoServidor(
      () => requisitar<ProvaDoServidor>(`/provas/${prova.id}`, { method: 'PUT', body: conteudo }),
      carregarProvasDoServidor,
    );
  }
}

function agendarEnvio(): void {
  window.clearTimeout(envioAgendado);
  envioAgendado = window.setTimeout(enviarProvasAlteradas, 600);
}

if (apiLigada) {
  watch([provasNoNavegador, blocosPorProva], agendarEnvio, { deep: true });
  // Fechar a aba logo depois de editar não pode perder a última alteração.
  window.addEventListener('pagehide', () => {
    if (envioAgendado !== undefined) enviarProvasAlteradas();
  });
} else {
  watch([provasNoNavegador, blocosPorProva], gravar, { deep: true });
}

export function listarProvas(): Prova[] {
  return provasNoNavegador;
}

export function encontrarProva(id: string): Prova | undefined {
  return provasNoNavegador.find((prova) => prova.id === id);
}

export function criarProva(dados: { title: string; description?: string }): Prova {
  const prova: Prova = {
    // Com a API, o id nasce aqui para o editor abrir sem esperar a resposta.
    id: apiLigada ? crypto.randomUUID() : `prova-local-${Date.now()}`,
    teacherId: 'prof-1',
    title: dados.title,
    description: dados.description,
    questions: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
  };
  provasNoNavegador.unshift(prova);
  return prova;
}

export function atualizarQuestoesDaProva(id: string, questions: Prova['questions']): void {
  const prova = encontrarProva(id);
  if (prova) prova.questions = questions;
}

/**
 * Blocos de uma prova, criados a partir das questões existentes na primeira visita e
 * preservados a partir daí.
 */
export function obterBlocosDaProva(prova: Prova): BlocoDaProva[] {
  if (!blocosPorProva[prova.id]) {
    blocosPorProva[prova.id] = blocosIniciaisApartirDeProva(prova);
  }
  return blocosPorProva[prova.id];
}

/**
 * Descarta o que o navegador guardou e volta ao acervo de demonstração. Com a API
 * ligada, recarrega do servidor: o acervo de demonstração lá é refeito pelo seed.
 */
export function reiniciarComOsMocks(): void {
  if (apiLigada) {
    void carregarProvasDoServidor();
    return;
  }
  const zerado = apartirDosMocks();
  provasNoNavegador.splice(0, provasNoNavegador.length, ...zerado.provas);
  for (const id of Object.keys(blocosPorProva)) delete blocosPorProva[id];
}
