import type { PapelUsuario } from '@sgp/shared-types';

/** Quem faz a requisicao, como os modulos de dominio precisam enxergar (RNF04). */
export interface UsuarioAutenticado {
  id: string;
  role: PapelUsuario;
}

/**
 * Requisicao depois da identificacao. `usuario` fica vazio quando ninguem foi
 * identificado; quem decide se isso e aceitavel e o guard da rota.
 */
export interface RequisicaoIdentificada {
  usuario?: UsuarioAutenticado;
}
