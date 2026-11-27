import bcrypt from 'bcryptjs';

/**
 * Senha nunca e gravada em texto (RF01, #80): `usuarios.passwordHash` guarda o hash
 * bcrypt, que ja inclui o sal e o custo. `conferirSenha` fica pronta para o login (#81).
 *
 * `bcryptjs` e a implementacao em JavaScript puro: nao depende de compilacao nativa no
 * build do Render.
 */
const CUSTO = 12;

export function gerarHashDeSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO);
}

export function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}
