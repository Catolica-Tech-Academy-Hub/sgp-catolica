/**
 * Banco de questões do professor (RF02).
 *
 * Com a API ligada (`VITE_API_URL`, ver `api.ts`), o acervo inteiro vem do servidor por
 * `carregarQuestoesDoServidor`, chamada antes de montar a aplicação — inclusive as
 * excluídas logicamente —, e cada alteração é gravada lá.
 *
 * Sem a API, é a extensão local do protótipo N1: os mocks continuam sendo a semente
 * imutável, e questões criadas dentro da prova só entram aqui quando o professor escolhe
 * “Salvar no banco”, sobrevivendo ao F5 no navegador.
 */
import { reactive, watch } from 'vue';
import { questoesMock } from '@sgp/mocks';
import type { Questao } from '@sgp/shared-types';
import { apiLigada, enviarAoServidor, requisitar } from './api';

const CHAVE = 'sgp:questoes-locais:v1';

/** Com a API ligada não há semente: o servidor já devolve o acervo completo. */
const semente: Questao[] = apiLigada ? [] : questoesMock;

function clonar(questao: Questao): Questao {
  return JSON.parse(JSON.stringify(questao)) as Questao;
}

function ler(): Questao[] {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return [];
    const lido = JSON.parse(bruto) as unknown;
    return Array.isArray(lido) ? (lido as Questao[]) : [];
  } catch {
    return [];
  }
}

const questoesLocais = reactive<Questao[]>(apiLigada ? [] : ler());

if (!apiLigada) {
  watch(
    questoesLocais,
    () => {
      try {
        window.localStorage.setItem(CHAVE, JSON.stringify(questoesLocais));
      } catch {
        // O editor continua funcionando sem persistência local.
      }
    },
    { deep: true },
  );
}

/** Substitui o acervo pelo que o servidor tem. Só faz sentido com a API ligada. */
export async function carregarQuestoesDoServidor(): Promise<void> {
  const questoes = await requisitar<Questao[]>('/questoes?incluirExcluidas=true');
  questoesLocais.splice(0, questoesLocais.length, ...questoes);
}

/** Grava uma alteração já aplicada na memória e sincroniza a questão com a resposta. */
function enviarQuestao(caminho: string, opcoes: RequestInit): void {
  if (!apiLigada) return;
  enviarAoServidor(
    () => requisitar<Questao>(caminho, opcoes),
    carregarQuestoesDoServidor,
    (resposta) => {
      const indice = questoesLocais.findIndex((item) => item.id === resposta.id);
      if (indice >= 0) questoesLocais[indice] = resposta;
    },
  );
}

/**
 * Acervo ativo do banco: exclui o que foi excluido logicamente.
 *
 * O filtro de `deletedAt` mora aqui, e nao em cada tela, porque o banco e lido tanto
 * pela tela dedicada quanto pelo painel do banco dentro do editor de prova. Filtrar em
 * um chamador so deixaria o outro oferecendo questao ja excluida.
 */
export function listarQuestoesDoBanco(): Questao[] {
  return [
    ...questoesLocais,
    ...semente.filter((mock) => !questoesLocais.some((item) => item.id === mock.id)),
  ].filter((questao) => !questao.deletedAt);
}

/**
 * Resolve uma questao pelo id, **inclusive excluida**.
 *
 * Diferente de `listarQuestoesDoBanco`, aqui a questao excluida continua sendo
 * encontrada de proposito: uma prova que ja referencia aquele id precisa continuar
 * renderizando o enunciado, senao a exclusao no banco esvaziaria provas antigas.
 */
export function encontrarQuestaoDoBanco(id: string): Questao | undefined {
  return (
    questoesLocais.find((questao) => questao.id === id) ??
    semente.find((questao) => questao.id === id)
  );
}

export function questaoEstaNoBanco(id: string): boolean {
  return listarQuestoesDoBanco().some((questao) => questao.id === id);
}

export function salvarQuestaoNoBanco(questao: Questao): 'criada' | 'atualizada' {
  const indice = questoesLocais.findIndex((item) => item.id === questao.id);
  const copia = clonar(questao);
  // Salvar devolve a questão ao acervo ativo, como faz a API.
  if (apiLigada) delete copia.deletedAt;

  // Só os campos do tipo: o editor pode carregar alternativas de quando a questão era
  // objetiva, e a API recusa discursiva com alternativas.
  const { id, type, statement, tags, alternatives, correctAlternativeId, maxScore } = copia;
  const doTipo = type === 'objetiva' ? { alternatives, correctAlternativeId } : { maxScore };
  enviarQuestao(`/questoes/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ type, statement, tags, ...doTipo }),
  });

  if (indice >= 0) {
    questoesLocais[indice] = copia;
    return 'atualizada';
  }
  questoesLocais.unshift(copia);
  return 'criada';
}

export function excluirQuestaoDoBanco(id: string): void {
  enviarQuestao(`/questoes/${id}`, { method: 'DELETE' });

  const indice = questoesLocais.findIndex((item) => item.id === id);

  if (indice >= 0) {
    questoesLocais[indice] = {
      ...questoesLocais[indice],
      deletedAt: new Date().toISOString(),
    };
    return;
  }

  const doMock = semente.find((item) => item.id === id);

  if (!doMock) return;

  questoesLocais.unshift({
    ...clonar(doMock),
    deletedAt: new Date().toISOString(),
  });
}

export function restaurarQuestaoDoBanco(id: string): void {
  const indice = questoesLocais.findIndex((item) => item.id === id);

  if (indice < 0) return;

  const atual = { ...questoesLocais[indice] };

  delete atual.deletedAt;

  questoesLocais[indice] = atual;
  enviarQuestao(`/questoes/${id}/restaurar`, { method: 'POST' });
}
