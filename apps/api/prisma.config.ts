import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` nao precisa de banco; so migracao e seed usam a URL.
    url: paraUrlDoPrisma(process.env.DATABASE_URL ?? ''),
  },
});

/**
 * O motor de migracao do Prisma nao entende `ssl-mode`, o parametro da URL do Aiven, e
 * le a autoridade certificadora de um arquivo (`sslcert`), nao de uma variavel. Com TLS,
 * grava `DATABASE_CA_CERT` num arquivo temporario e aponta a URL para ele, conferindo o
 * certificado do servidor (`sslaccept=strict`), como faz `src/prisma/adaptador.ts`.
 */
function paraUrlDoPrisma(databaseUrl: string): string {
  if (!databaseUrl) return databaseUrl;
  const url = new URL(databaseUrl);
  const modo = url.searchParams.get('ssl-mode');
  if (modo === null) return databaseUrl;

  url.searchParams.delete('ssl-mode');
  const autoridade = process.env.DATABASE_CA_CERT;
  if (modo.toUpperCase() !== 'DISABLED' && autoridade) {
    const arquivo = join(tmpdir(), 'sgp-mysql-ca.pem');
    writeFileSync(arquivo, autoridade);
    url.searchParams.set('sslcert', arquivo);
    url.searchParams.set('sslaccept', 'strict');
  }
  return url.toString();
}
