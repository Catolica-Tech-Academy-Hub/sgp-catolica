import type { FonteDeImagem, NucleoDeLeitura } from '../lib/leitura-do-cartao';
import { lerBolhas } from './bolhas';
import { criarLayoutProvisorioDeBolhas } from './layout-provisorio';
import { detectarMarcadores, LAYOUT_PROVISORIO } from './marcadores';
import { aplicarHomografia, calcularPerspectiva } from './perspectiva';

/** Liga as etapas da viabilidade (#98) ao layout provisorio, que depende da issue #92. */
export const nucleoDeLeitura: NucleoDeLeitura = {
  detectar: (imagem) => detectarMarcadores(imagem, LAYOUT_PROVISORIO),
  calcularPerspectiva: (marcadores) => calcularPerspectiva(marcadores, LAYOUT_PROVISORIO),
  aplicarHomografia,
  lerBolhas,
  criarLayout: criarLayoutProvisorioDeBolhas,
};

/**
 * Ponto de integracao da captura. Sem camera ligada nao ha fonte, e a tela mostra a
 * leitura bloqueada em vez de simular um resultado.
 */
let fonteDeImagem: FonteDeImagem | undefined;

export function definirFonteDeImagem(fonte: FonteDeImagem | undefined): void {
  fonteDeImagem = fonte;
}

export function obterFonteDeImagem(): FonteDeImagem | undefined {
  return fonteDeImagem;
}
