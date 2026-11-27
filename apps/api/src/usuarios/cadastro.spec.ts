/**
 * Cadastro de professor e estudante (RF01, #80, RNF09): dominio por tipo, senha com hash e
 * e-mail unico. O banco em memoria reproduz a chave unica de `usuarios.email` e
 * `usuarios.registration`, como o MySQL.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { CadastroDto } from './cadastro.dto';
import { CadastroService } from './cadastro.service';
import { emailDoPapel, normalizarEmail } from './regras';
import { conferirSenha, gerarHashDeSenha } from './senha';

type Linha = Record<string, unknown>;

function criarBanco() {
  const usuarios: Linha[] = [];
  const banco = {
    usuario: {
      create: async ({ data }: { data: Linha }) => {
        const repetido = usuarios.some(
          (u) =>
            u.email === data.email || (data.registration && u.registration === data.registration),
        );
        if (repetido) {
          throw new Prisma.PrismaClientKnownRequestError('Unico.', {
            code: 'P2002',
            clientVersion: 'teste',
          });
        }
        const linha = { id: `usr-${usuarios.length + 1}`, createdAt: new Date(), ...data };
        usuarios.push(linha);
        return linha;
      },
    },
  };
  return { banco: banco as unknown as PrismaService, usuarios };
}

const professora: CadastroDto = {
  role: 'professor',
  fullName: 'Marta Lima',
  email: ' Marta.Lima@CatolicaSC.org.br ',
  password: 'senha-forte',
};

const estudante: CadastroDto = {
  role: 'estudante',
  fullName: 'Joao Pedro',
  email: 'joao.pedro@catolicasc.edu.br',
  password: 'outra-senha',
  registration: '2026500',
};

let usuarios: Linha[];
let servico: CadastroService;

beforeEach(() => {
  const criado = criarBanco();
  usuarios = criado.usuarios;
  servico = new CadastroService(criado.banco);
});

describe('regras de dominio', () => {
  it('cada papel so aceita o proprio dominio institucional', () => {
    assert.ok(emailDoPapel('ana@catolicasc.edu.br', 'estudante'));
    assert.ok(emailDoPapel(' Ana@CatolicaSC.org.br ', 'professor'));
    assert.equal(emailDoPapel('ana@catolicasc.org.br', 'estudante'), false);
    assert.equal(emailDoPapel('ana@catolicasc.edu.br', 'professor'), false);
  });

  it('recusa dominio parecido e e-mail sem nada antes do @', () => {
    assert.equal(emailDoPapel('ana@catolicasc.edu.br.exemplo.com', 'estudante'), false);
    assert.equal(emailDoPapel('@catolicasc.org.br', 'professor'), false);
    assert.equal(emailDoPapel('ana@gmail.com', 'estudante'), false);
  });

  it('normaliza espacos e maiusculas', () => {
    assert.equal(normalizarEmail('  Ana@CatolicaSC.edu.br '), 'ana@catolicasc.edu.br');
  });
});

describe('senha', () => {
  it('o hash nao contem a senha e confere so a senha certa', async () => {
    const hash = await gerarHashDeSenha('senha-forte');
    assert.notEqual(hash, 'senha-forte');
    assert.ok(!hash.includes('senha-forte'));
    assert.match(hash, /^\$2[aby]\$12\$/);
    assert.equal(await conferirSenha('senha-forte', hash), true);
    assert.equal(await conferirSenha('senha-errada', hash), false);
  });
});

describe('cadastro', () => {
  it('cria professor com e-mail normalizado e devolve sem o hash', async () => {
    const criado = await servico.cadastrar(professora);
    assert.equal(criado.role, 'professor');
    assert.equal(criado.email, 'marta.lima@catolicasc.org.br');
    assert.equal('passwordHash' in criado, false);

    const linha = usuarios[0];
    assert.equal(linha.email, 'marta.lima@catolicasc.org.br');
    assert.equal(await conferirSenha('senha-forte', String(linha.passwordHash)), true);
  });

  it('cria estudante com matricula; professor nao guarda matricula', async () => {
    const criado = await servico.cadastrar(estudante);
    assert.equal(criado.role, 'estudante');
    assert.equal(criado.role === 'estudante' && criado.registration, '2026500');

    await servico.cadastrar({ ...professora, registration: '999' });
    assert.equal(usuarios[1].registration, null);
  });

  it('recusa e-mail de outro dominio sem gravar nada', async () => {
    await assert.rejects(
      servico.cadastrar({ ...estudante, email: 'joao@catolicasc.org.br' }),
      BadRequestException,
    );
    await assert.rejects(
      servico.cadastrar({ ...professora, email: 'marta@gmail.com' }),
      BadRequestException,
    );
    assert.equal(usuarios.length, 0);
  });

  it('e-mail ja usado responde 409, mesmo com maiusculas diferentes', async () => {
    await servico.cadastrar(professora);
    await assert.rejects(
      servico.cadastrar({ ...professora, email: 'MARTA.LIMA@catolicasc.org.br' }),
      ConflictException,
    );
    assert.equal(usuarios.length, 1);
  });
});
