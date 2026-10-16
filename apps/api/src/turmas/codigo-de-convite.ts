import { randomInt } from 'node:crypto';

/** Sem caracteres ambiguos (0/O, 1/I) para o codigo ser legivel quando ditado ou copiado. */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Gerado no servidor, e nao no navegador, porque o codigo e o que autoriza um estudante
 * a entrar na turma (RF03): quem o gera precisa ser quem garante a unicidade.
 */
export function gerarCodigoDeConvite(): string {
  let sufixo = '';
  for (let indice = 0; indice < 4; indice += 1) {
    sufixo += ALFABETO[randomInt(ALFABETO.length)];
  }
  return `TURMA-${new Date().getFullYear()}-${sufixo}`;
}
