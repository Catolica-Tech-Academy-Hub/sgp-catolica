/**
 * Protótipo de montagem de prova por blocos — proposta em avaliação (issue #12).
 *
 * Este modelo NÃO faz parte do domínio aprovado em `@sgp/shared-types`. RF04 define
 * uma prova como título, descrição e uma lista de questões pontuadas; o que existe
 * aqui é uma camada de autoria opcional, só desta tela, para demonstrar uma forma
 * mais livre de montar a prova (com texto de apoio, imagem e espaço para resposta)
 * antes de a equipe e a professora decidirem se isso entra no produto.
 *
 * Os blocos do tipo "questao" colapsam para o mesmo `QuestaoDaProva[]` que
 * `Prova.questions` usa (ver `questoesParaProva`). Na impressão, a API também lê os
 * blocos persistidos para posicionar conteúdo de apoio e aplicar a ordem materializada.
 *
 * ## Limite entre conteúdo e configuração de impressão
 *
 * Embaralhamento e quebra de página pertencem à **aplicação**, não à prova:
 *
 * - O antigo bloco de seção carregava embaralhamento, que RF06 trata como opção de
 *   geração de versão. O editor agora oferece "Título de seção" apenas como conteúdo
 *   impresso, sem comportamento de aplicação.
 * - Quebra de página é decisão de impressão, e RF05 é explícito: "toda configuração de
 *   PDF pertence à aplicação, não à prova". A substituta é a paginação A4 automática,
 *   com a regra de não partir uma questão entre páginas (pendência #14).
 *
 * Os dois conceitos antigos foram removidos: um desenhava uma linha tracejada e o outro
 * guardava uma chave que nada lia. A configuração efetiva é aplicada na geração da
 * aplicação; a paginação mantém a regra de não partir blocos entre folhas.
 */
import type { Prova, Questao, QuestaoDaProva } from '@sgp/shared-types';

export type TipoDeBloco = 'titulo' | 'texto' | 'imagem' | 'questao' | 'espaco';

export type TamanhoDeEspaco = 'pequeno' | 'medio' | 'grande';
export type EstiloDeTexto = 'paragrafo' | 'instrucoes' | 'destaque';
export type FormatoDeResposta = 'objetiva' | 'curta' | 'longa';
export type TipoDeInsercao =
  'questao-objetiva' | 'questao-curta' | 'questao-longa' | 'titulo' | 'texto' | 'imagem';

interface BlocoBase {
  id: string;
}

export interface BlocoDeTexto extends BlocoBase {
  type: 'texto';
  conteudo: string;
  /** Opcional para ler blocos gravados antes da introdução dos estilos. */
  estilo?: EstiloDeTexto;
}

export interface BlocoDeTitulo extends BlocoBase {
  type: 'titulo';
  titulo: string;
  descricao: string;
}

export interface BlocoDeImagem extends BlocoBase {
  type: 'imagem';
  /** Data URL lida localmente (FileReader); nunca sai do navegador nesta fase. */
  url?: string;
  legenda: string;
}

export interface BlocoDeQuestao extends BlocoBase {
  type: 'questao';
  questionId: string;
  /** Pontuação individual. A soma não é validada pelo sistema (RF04). */
  pontuacao: number;
  /** Variação de impressão da resposta; questões antigas são inferidas pelo domínio. */
  formatoResposta?: FormatoDeResposta;
  /** Cópia editável na prova. Só entra no banco quando o professor pedir. */
  rascunho?: Questao;
}

export interface BlocoDeEspaco extends BlocoBase {
  type: 'espaco';
  tamanho: TamanhoDeEspaco;
}

export type BlocoDaProva =
  BlocoDeTitulo | BlocoDeTexto | BlocoDeImagem | BlocoDeQuestao | BlocoDeEspaco;

export interface DefinicaoDeTipoDeBloco {
  tipo: TipoDeBloco;
  rotulo: string;
  descricao: string;
}

export const DEFINICOES_DE_BLOCO: DefinicaoDeTipoDeBloco[] = [
  {
    tipo: 'questao',
    rotulo: 'Questão do banco',
    descricao: 'Insere uma questão existente e define a pontuação.',
  },
  {
    tipo: 'titulo',
    rotulo: 'Título de seção',
    descricao: 'Organiza partes da prova sem alterar o embaralhamento.',
  },
  {
    tipo: 'texto',
    rotulo: 'Texto ou instrução',
    descricao: 'Parágrafo, orientação ou aviso em destaque.',
  },
  { tipo: 'imagem', rotulo: 'Imagem', descricao: 'Figura, gráfico ou mapa de apoio.' },
  {
    tipo: 'espaco',
    rotulo: 'Espaço para resposta',
    descricao: 'Área pautada com dimensão real para impressão A4.',
  },
];

/** Limite de questões por prova definido em RF04. */
export const MAXIMO_DE_QUESTOES = 20;

let contadorDeBlocos = 0;

function gerarIdDeBloco(tipo: TipoDeBloco): string {
  contadorDeBlocos += 1;
  return `bloco-${tipo}-${Date.now()}-${contadorDeBlocos}`;
}

/** Fábrica de blocos com valores padrão sensatos para cada tipo. */
export function criarBloco(tipo: Exclude<TipoDeBloco, 'questao'>): BlocoDaProva {
  const id = gerarIdDeBloco(tipo);
  switch (tipo) {
    case 'titulo':
      return { id, type: 'titulo', titulo: '', descricao: '' };
    case 'texto':
      return { id, type: 'texto', conteudo: '', estilo: 'paragrafo' };
    case 'imagem':
      return { id, type: 'imagem', legenda: '' };
    case 'espaco':
      return { id, type: 'espaco', tamanho: 'medio' };
  }
}

/** Duplica conteúdo e propriedades, mas sempre cria uma identidade nova para o bloco. */
export function duplicarBloco(bloco: BlocoDaProva): BlocoDaProva {
  const copia = JSON.parse(JSON.stringify(bloco)) as BlocoDaProva;
  copia.id = gerarIdDeBloco(bloco.type);
  if (copia.type === 'questao' && copia.rascunho) {
    const novoId = `questao-local-${Date.now()}-${contadorDeBlocos}`;
    const mapaDeAlternativas = new Map<string, string>();
    copia.rascunho.id = novoId;
    copia.questionId = novoId;
    if (copia.rascunho.type === 'objetiva' && copia.rascunho.alternatives) {
      copia.rascunho.alternatives = copia.rascunho.alternatives.map((alternativa, indice) => {
        const novoIdDaAlternativa = `${novoId}-alternativa-${indice + 1}`;
        mapaDeAlternativas.set(alternativa.id, novoIdDaAlternativa);
        return { ...alternativa, id: novoIdDaAlternativa };
      });
      copia.rascunho.correctAlternativeId = copia.rascunho.correctAlternativeId
        ? mapaDeAlternativas.get(copia.rascunho.correctAlternativeId)
        : undefined;
    }
  }
  return copia;
}

function alternativasIniciais(questaoId: string): NonNullable<Questao['alternatives']> {
  return Array.from({ length: 4 }, (_, indice) => ({
    id: `${questaoId}-alternativa-${indice + 1}`,
    text: '',
  }));
}

/** Cria uma questão diretamente na prova, ainda independente do banco. */
export function criarBlocoDeQuestaoVazia(formato: FormatoDeResposta): BlocoDeQuestao {
  const id = gerarIdDeBloco('questao');
  const questionId = `questao-local-${Date.now()}-${contadorDeBlocos}`;
  const objetiva = formato === 'objetiva';
  return {
    id,
    type: 'questao',
    questionId,
    pontuacao: 1,
    formatoResposta: formato,
    rascunho: {
      id: questionId,
      teacherId: 'prof-1',
      type: objetiva ? 'objetiva' : 'discursiva',
      statement: '',
      tags: [],
      ...(objetiva ? { alternatives: alternativasIniciais(questionId) } : { maxScore: 1 }),
    },
  };
}

/** Traz uma cópia do banco: editar a prova não altera silenciosamente o acervo. */
export function criarBlocoDeQuestao(questao: Questao, pontuacaoPadrao: number): BlocoDeQuestao {
  return {
    id: gerarIdDeBloco('questao'),
    type: 'questao',
    questionId: questao.id,
    pontuacao: pontuacaoPadrao,
    formatoResposta: questao.type === 'objetiva' ? 'objetiva' : 'longa',
    rascunho: JSON.parse(JSON.stringify(questao)) as Questao,
  };
}

/**
 * Ponto de partida ao abrir pela primeira vez uma prova que já tinha questões no
 * formato atual (`Prova.questions`). Assim, uma prova criada antes deste protótipo
 * chega com o mesmo conteúdo, só que representado como blocos.
 */
export function blocosIniciaisApartirDeProva(prova: Prova): BlocoDaProva[] {
  return [...prova.questions]
    .sort((a, b) => a.order - b.order)
    .map((questao): BlocoDeQuestao => ({
      id: gerarIdDeBloco('questao'),
      type: 'questao',
      questionId: questao.questionId,
      pontuacao: questao.score,
    }));
}

/** Projeta os blocos de volta para o formato que `Prova.questions` espera hoje. */
export function questoesParaProva(blocos: BlocoDaProva[]): QuestaoDaProva[] {
  return blocos
    .filter((bloco): bloco is BlocoDeQuestao => bloco.type === 'questao')
    .map((bloco, indice) => ({
      questionId: bloco.questionId,
      order: indice + 1,
      score: bloco.pontuacao,
    }));
}

export function totalDePontos(blocos: BlocoDaProva[]): number {
  return blocos
    .filter((bloco): bloco is BlocoDeQuestao => bloco.type === 'questao')
    .reduce((total, bloco) => total + bloco.pontuacao, 0);
}

export function contarQuestoes(blocos: BlocoDaProva[]): number {
  return blocos.filter((bloco) => bloco.type === 'questao').length;
}

/**
 * Número impresso de cada questão, por id de bloco. A numeração é a única coisa que
 * o aluno usa para responder, então ela vem da ordem na folha, não do cadastro.
 */
export function numeracaoDasQuestoes(blocos: BlocoDaProva[]): Record<string, number> {
  const numeros: Record<string, number> = {};
  let atual = 0;
  for (const bloco of blocos) {
    if (bloco.type === 'questao') {
      atual += 1;
      numeros[bloco.id] = atual;
    }
  }
  return numeros;
}
