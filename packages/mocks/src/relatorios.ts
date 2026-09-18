import type { EstatisticaAplicacao, EstatisticaQuestao } from '@sgp/shared-types';
import { aplicacoesMock, provasMock, versoesMock } from './provas';
import { correcoesMock } from './correcoes';

/**
 * Estatisticas de aplicacao e de questao (RF10).
 *
 * Diferente dos demais mocks, estes nao sao digitados a mao: sao **derivados** das
 * correcoes. Uma media escrita a mao envelheceria no primeiro registro novo em
 * `correcoesMock` e passaria a contradizer a lista de alunos exibida ao lado dela na
 * mesma tela — exatamente o tipo de incoerencia que a auditoria existe para impedir.
 *
 * Quando a API de relatorios existir, este arquivo sai e o calculo passa a ser do
 * servidor; a forma dos dados (`EstatisticaAplicacao`) continua a mesma.
 */

/** Quantas faixas a distribuicao usa. Cinco cobre a leitura sem virar histograma denso. */
const FAIXAS = 5;

const arredondar = (valor: number): number => Math.round(valor * 100) / 100;

function media(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((total, valor) => total + valor, 0) / valores.length;
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];
}

/** Desvio padrao populacional: o conjunto avaliado e a turma inteira, nao uma amostra dela. */
function desvioPadrao(valores: number[]): number {
  if (valores.length === 0) return 0;
  const m = media(valores);
  return Math.sqrt(media(valores.map((valor) => (valor - m) ** 2)));
}

/**
 * Distribui as notas em faixas do tamanho do teto da prova dividido por `FAIXAS`.
 *
 * A largura vem do teto da prova, e nao de um "0 a 10" fixo, porque a pontuacao total
 * e livre (RF04): uma prova que vale 20 continuaria empilhando tudo na ultima faixa.
 * A nota maxima entra na ultima faixa, que por isso e fechada dos dois lados.
 */
function distribuir(valores: number[], teto: number): { faixa: string; quantidade: number }[] {
  const largura = teto / FAIXAS;

  return Array.from({ length: FAIXAS }, (_, indice) => {
    const inicio = largura * indice;
    const fim = largura * (indice + 1);
    const ultima = indice === FAIXAS - 1;

    return {
      faixa: `${arredondar(inicio)}-${arredondar(fim)}`,
      quantidade: valores.filter(
        (valor) => valor >= inicio && (ultima ? valor <= fim : valor < fim),
      ).length,
    };
  });
}

/** Notas ja atribuidas a um aluno numa aplicacao. Correcao pendente de RF09 nao entra. */
function notasDaAplicacao(applicationId: string): number[] {
  const versoes = versoesMock
    .filter((versao) => versao.applicationId === applicationId)
    .map((versao) => versao.id);

  return correcoesMock
    .filter((correcao) => versoes.includes(correcao.examVersionId) && correcao.studentId)
    .map((correcao) => correcao.totalScore);
}

export function tetoDaAplicacao(applicationId: string): number {
  const aplicacao = aplicacoesMock.find((item) => item.id === applicationId);
  const prova = provasMock.find((item) => item.id === aplicacao?.examId);
  return (prova?.questions ?? []).reduce((total, questao) => total + questao.score, 0);
}

export const estatisticasDeAplicacaoMock: EstatisticaAplicacao[] = aplicacoesMock
  .map((aplicacao) => {
    const notas = notasDaAplicacao(aplicacao.id);
    return {
      applicationId: aplicacao.id,
      media: arredondar(media(notas)),
      mediana: arredondar(mediana(notas)),
      desvioPadrao: arredondar(desvioPadrao(notas)),
      distribuicao: distribuir(notas, tetoDaAplicacao(aplicacao.id)),
    };
  })
  // Aplicacao sem nenhuma nota atribuida nao tem estatistica; nao vale exibir zeros.
  .filter((estatistica) => estatistica.distribuicao.some((faixa) => faixa.quantidade > 0));

/**
 * Percentual de acerto por questao objetiva de cada aplicacao.
 *
 * `marcacoesPorAlternativa` fica vazio de proposito: `Correcao` guarda apenas se a
 * questao foi acertada, nunca **qual** alternativa o aluno marcou. Preencher isso aqui
 * seria inventar dado que nem o aplicativo envia hoje. O tipo ja prevê o campo para
 * quando a API passar a devolve-lo (RF10).
 */
export const estatisticasDeQuestaoMock: EstatisticaQuestao[] = (() => {
  const acertos = new Map<string, { certas: number; total: number }>();

  for (const correcao of correcoesMock) {
    if (!correcao.studentId) continue;
    for (const resultado of correcao.objectiveResults) {
      const atual = acertos.get(resultado.questionId) ?? { certas: 0, total: 0 };
      atual.total += 1;
      if (resultado.correct) atual.certas += 1;
      acertos.set(resultado.questionId, atual);
    }
  }

  return [...acertos.entries()].map(([questionId, { certas, total }]) => ({
    questionId,
    percentualAcerto: arredondar((certas / total) * 100),
    marcacoesPorAlternativa: [],
  }));
})();
