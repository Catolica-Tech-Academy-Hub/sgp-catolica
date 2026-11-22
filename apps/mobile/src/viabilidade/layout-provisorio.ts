import type { LayoutDeBolhas } from './bolhas';

/**
 * Posicao provisoria das bolhas no A4 (issue #98), ate o layout definitivo do cartao ser
 * combinado na issue #92. Comporta 20 questoes de ate 5 alternativas.
 */
const RAIO_DA_BOLHA_MM = 3;
const COLUNAS_MM = [35, 120];
const PRIMEIRA_LINHA_MM = 80;
const PASSO_DA_LINHA_MM = 18;
const PASSO_DA_OPCAO_MM = 10;
const QUESTOES_POR_COLUNA = 10;
const MAXIMO_DE_OPCOES = 5;

/**
 * Devolve `undefined` quando a prova nao cabe no cartao provisorio. Sempre inclui as 5
 * posicoes da linha, mesmo em questao com menos alternativas: uma marca na posicao excedente
 * precisa ser vista, ou uma dupla marcacao pareceria uma resposta valida.
 */
export function criarLayoutProvisorioDeBolhas(
  opcoesPorQuestao: number[],
): LayoutDeBolhas | undefined {
  const cabe =
    opcoesPorQuestao.length > 0 &&
    opcoesPorQuestao.length <= COLUNAS_MM.length * QUESTOES_POR_COLUNA &&
    opcoesPorQuestao.every(
      (opcoes) => Number.isInteger(opcoes) && opcoes > 0 && opcoes <= MAXIMO_DE_OPCOES,
    );
  if (!cabe) return undefined;

  return {
    raioDaBolhaMm: RAIO_DA_BOLHA_MM,
    questoes: opcoesPorQuestao.map((_, indiceDaQuestao) => {
      const coluna = COLUNAS_MM[Math.floor(indiceDaQuestao / QUESTOES_POR_COLUNA)];
      const y = PRIMEIRA_LINHA_MM + (indiceDaQuestao % QUESTOES_POR_COLUNA) * PASSO_DA_LINHA_MM;
      return {
        indiceDaQuestao,
        bolhas: Array.from({ length: MAXIMO_DE_OPCOES }, (__, indiceDaOpcao) => ({
          indiceDaOpcao,
          centroMm: { x: coluna + indiceDaOpcao * PASSO_DA_OPCAO_MM, y },
        })),
      };
    }),
  };
}
