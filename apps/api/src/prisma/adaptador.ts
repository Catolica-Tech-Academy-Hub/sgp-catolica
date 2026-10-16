import { PrismaMariaDb } from '@prisma/adapter-mariadb';

/**
 * Adaptador do Prisma para o MySQL, pelo driver `mariadb` (compativel com MySQL).
 *
 * A URL e desmontada aqui, e nao repassada como texto, porque o MySQL 8 autentica com
 * `caching_sha2_password`: sem TLS, o driver precisa de `allowPublicKeyRetrieval`, e
 * esse parametro na URL quebraria o `prisma migrate`, que le a mesma variavel.
 */
export function criarAdaptadorMysql(databaseUrl = process.env.DATABASE_URL): PrismaMariaDb {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL nao definida. Copie apps/api/.env.example para apps/api/.env.');
  }

  const url = new URL(databaseUrl);
  return new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    allowPublicKeyRetrieval: true,
    connectionLimit: 5,
  });
}
