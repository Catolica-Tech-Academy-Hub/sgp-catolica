import { Prisma } from '../generated/prisma/client';

/** Violacao de chave unica (codigo P2002 do Prisma). */
export function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';
}
