import type { NucleoDeLeitura } from '../lib/leitura-do-cartao';
import { lerBolhas } from './bolhas';
import { criarLayoutProvisorioDeBolhas } from './layout-provisorio';
import { detectarMarcadores, LAYOUT_PROVISORIO } from './marcadores';
import { aplicarHomografia, calcularPerspectiva } from './perspectiva';

/** Liga as etapas da leitura (#98) ao layout provisorio, que depende da issue #92. */
export const nucleoDeLeitura: NucleoDeLeitura = {
  detectar: (imagem) => detectarMarcadores(imagem, LAYOUT_PROVISORIO),
  calcularPerspectiva: (marcadores) => calcularPerspectiva(marcadores, LAYOUT_PROVISORIO),
  aplicarHomografia,
  lerBolhas,
  criarLayout: criarLayoutProvisorioDeBolhas,
};
