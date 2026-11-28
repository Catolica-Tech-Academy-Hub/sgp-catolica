import type { PapelUsuario } from '@sgp/shared-types';

/**
 * RF01: cada papel so se cadastra com o dominio institucional dele. A regra fica aqui,
 * sem banco, e e a mesma usada pela entrada pelo codigo de convite (`convites/regras.ts`).
 */
export const DOMINIO_POR_PAPEL: Record<PapelUsuario, string> = {
  estudante: '@catolicasc.edu.br',
  professor: '@catolicasc.org.br',
};

/** Minimo de RF01; o maximo protege o hash (o bcrypt so le os primeiros 72 bytes). */
export const SENHA_MINIMA = 8;
export const SENHA_MAXIMA = 72;

/** E-mail como e comparado e gravado: sem espacos nas pontas e em minusculas. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** O e-mail termina no dominio do papel e tem algo antes do `@`. */
export function emailDoPapel(email: string, papel: PapelUsuario): boolean {
  const normalizado = normalizarEmail(email);
  const dominio = DOMINIO_POR_PAPEL[papel];
  return normalizado.endsWith(dominio) && normalizado.length > dominio.length;
}

export function mensagemDeDominio(papel: PapelUsuario): string {
  const quem = papel === 'professor' ? 'professor' : 'estudante';
  return `Use o e-mail institucional de ${quem} (${DOMINIO_POR_PAPEL[papel]}).`;
}
