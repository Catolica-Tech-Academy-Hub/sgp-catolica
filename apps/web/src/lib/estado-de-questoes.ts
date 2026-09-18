/**
 * Extensão local do banco de questões para o protótipo N1.
 *
 * Os mocks continuam sendo a semente imutável. Questões criadas dentro da prova só
 * entram aqui quando o professor escolhe “Salvar no banco”, e sobrevivem ao F5 no
 * navegador até a API de RF02 existir.
 */
import { reactive, watch } from 'vue';
import { questoesMock } from '@sgp/mocks';
import type { Questao } from '@sgp/shared-types';

const CHAVE = 'sgp:questoes-locais:v1';

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

const questoesLocais = reactive<Questao[]>(ler());

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
    ...questoesMock.filter((mock) => !questoesLocais.some((item) => item.id === mock.id)),
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
    questoesMock.find((questao) => questao.id === id)
  );
}

export function questaoEstaNoBanco(id: string): boolean {
  return listarQuestoesDoBanco().some((questao) => questao.id === id);
}

export function salvarQuestaoNoBanco(questao: Questao): 'criada' | 'atualizada' {
  const indice = questoesLocais.findIndex((item) => item.id === questao.id);
  const copia = clonar(questao);
  if (indice >= 0) {
    questoesLocais[indice] = copia;
    return 'atualizada';
  }
  questoesLocais.unshift(copia);
  return 'criada';
}

export function excluirQuestaoDoBanco(id: string): void {
  const indice = questoesLocais.findIndex((item) => item.id === id);

  if (indice >= 0) {
    questoesLocais[indice] = {
      ...questoesLocais[indice],
      deletedAt: new Date().toISOString(),
    };
    return;
  }

  const doMock = questoesMock.find((item) => item.id === id);

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
}
