/**
 * Entrada pelo codigo de convite (RF03, RNF09). O banco em memoria desfaz a transacao
 * inteira quando ela falha, como o MySQL: e isso que prova que conta e matricula entram
 * juntas ou nao entram.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { ConvitesService } from './convites.service';
import { type CredenciaisDoEstudante, CredenciaisIndisponiveis } from './credenciais';
import { decidirEntrada, emailDeEstudante } from './regras';

type Linha = Record<string, unknown>;
const DATA = new Date('2026-03-01T12:00:00.000Z');

function unicidade(): Error {
  return new Prisma.PrismaClientKnownRequestError('Unico.', {
    code: 'P2002',
    clientVersion: 'teste',
  });
}

function criarBanco() {
  const tabelas = {
    usuario: [
      {
        id: 'prof-1',
        role: 'professor',
        fullName: 'Helena Marques',
        email: 'h@docente.example.org',
        registration: null,
        createdAt: DATA,
      },
      {
        id: 'est-1',
        role: 'estudante',
        fullName: 'Alice',
        email: 'alice@catolicasc.edu.br',
        registration: '2026101',
        createdAt: DATA,
      },
      {
        id: 'est-2',
        role: 'estudante',
        fullName: 'Bruno',
        email: 'bruno@catolicasc.edu.br',
        registration: null,
        createdAt: DATA,
      },
    ] as Linha[],
    turma: [
      {
        id: 'turma-1',
        teacherId: 'prof-1',
        name: 'Arquitetura',
        subject: 'ES',
        term: '2026/1',
        status: 'active',
        inviteCode: 'PAS-2026-7QK4',
      },
      {
        id: 'turma-arq',
        teacherId: 'prof-1',
        name: 'Antiga',
        subject: 'ES',
        term: '2025/2',
        status: 'archived',
        inviteCode: 'OLD-2025-AAAA',
      },
    ] as Linha[],
    matricula: [
      {
        id: 'mat-removida',
        classId: 'turma-1',
        studentId: 'est-2',
        enrolledAt: DATA,
        status: 'removed',
        enrolledVia: 'teacher',
      },
    ] as Linha[],
  };

  const modelos = {
    usuario: {
      create: async ({ data }: { data: Linha }) => {
        const repetido = tabelas.usuario.some(
          (u) =>
            u.email === data.email || (data.registration && u.registration === data.registration),
        );
        if (repetido) throw unicidade();
        const usuario = { ...data, id: `est-novo-${tabelas.usuario.length}`, createdAt: DATA };
        tabelas.usuario.push(usuario);
        return usuario;
      },
    },
    turma: {
      findUnique: async ({
        where,
        include,
      }: {
        where: { inviteCode: string };
        include?: Linha;
      }) => {
        const turma = tabelas.turma.find((t) => t.inviteCode === where.inviteCode);
        if (!turma) return null;
        if (!include) return turma;
        const professor = tabelas.usuario.find((u) => u.id === turma.teacherId)!;
        return { ...turma, professor: { fullName: professor.fullName } };
      },
    },
    matricula: {
      findUnique: async ({
        where,
      }: {
        where: { classId_studentId: { classId: string; studentId: string } };
      }) =>
        tabelas.matricula.find(
          (m) =>
            m.classId === where.classId_studentId.classId &&
            m.studentId === where.classId_studentId.studentId,
        ) ?? null,
      create: async ({ data }: { data: Linha }) => {
        if (
          tabelas.matricula.some(
            (m) => m.classId === data.classId && m.studentId === data.studentId,
          )
        ) {
          throw unicidade();
        }
        const matricula = {
          ...data,
          id: `mat-${tabelas.matricula.length + 1}`,
          enrolledAt: DATA,
          status: 'active',
        };
        tabelas.matricula.push(matricula);
        return matricula;
      },
    },
  };

  const banco = {
    ...modelos,
    /** Desfaz tudo se a transacao falhar, como o banco real. */
    $transaction: async <T>(executar: (tx: typeof modelos) => Promise<T>) => {
      const copia = JSON.parse(JSON.stringify(tabelas)) as typeof tabelas;
      try {
        return await executar(modelos);
      } catch (erro) {
        for (const chave of Object.keys(tabelas) as (keyof typeof tabelas)[]) {
          tabelas[chave].splice(0, tabelas[chave].length, ...copia[chave]);
        }
        throw erro;
      }
    },
  };

  return { banco: banco as unknown as PrismaService, tabelas };
}

const credenciaisDeTeste: CredenciaisDoEstudante = {
  prepararSenha: async (senha) => `hash:${senha}`,
  abrirSessao: async ({ id }) => ({ accessToken: `jwt:${id}`, refreshToken: `refresh:${id}` }),
};

const cadastro = {
  fullName: 'Carla Nova',
  email: 'Carla.Nova@catolicasc.edu.br ',
  registration: '2026199',
  password: 'senha-forte',
};

let tabelas: ReturnType<typeof criarBanco>['tabelas'];
let servico: ConvitesService;

beforeEach(() => {
  const criado = criarBanco();
  tabelas = criado.tabelas;
  servico = new ConvitesService(criado.banco, credenciaisDeTeste);
});

describe('regras', () => {
  it('ja matriculado vale mesmo em turma arquivada; removido nao volta sozinho', () => {
    assert.deepEqual(
      decidirEntrada({ turma: { status: 'archived' }, matriculaExistente: { status: 'active' } }),
      { tipo: 'ja-matriculado' },
    );
    assert.deepEqual(
      decidirEntrada({ turma: { status: 'active' }, matriculaExistente: { status: 'removed' } }),
      { tipo: 'recusar', motivo: 'matricula-removida' },
    );
  });

  it('aceita so o dominio de estudante', () => {
    assert.ok(emailDeEstudante(' Ana@CatolicaSC.edu.br'));
    assert.equal(emailDeEstudante('ana@catolicasc.org.br'), false);
    assert.equal(emailDeEstudante('@catolicasc.edu.br'), false);
    assert.equal(emailDeEstudante('ana@catolicasc.edu.br.exemplo.com'), false);
  });
});

describe('estudante com sessao', () => {
  it('matricula pelo codigo, sem diferenciar maiusculas, e a segunda entrada nao duplica', async () => {
    const estudante = { id: 'est-1', role: 'estudante' as const };
    const primeira = await servico.entrar(' pas-2026-7qk4 ', estudante, async () => cadastro);
    const segunda = await servico.entrar('PAS-2026-7QK4', estudante, async () => cadastro);
    assert.equal(primeira.matricula.enrolledVia, 'invite_code');
    assert.equal(segunda.matricula.id, primeira.matricula.id);
    assert.equal(tabelas.matricula.filter((m) => m.studentId === 'est-1').length, 1);
    assert.equal(primeira.sessao, undefined);
  });

  it('codigo regenerado deixa de valer', async () => {
    tabelas.turma[0].inviteCode = 'PAS-2026-NOVO';
    await assert.rejects(servico.matricularEstudante('PAS-2026-7QK4', 'est-1'), NotFoundException);
  });

  it('turma arquivada e matricula removida recusam a entrada', async () => {
    await assert.rejects(servico.matricularEstudante('OLD-2025-AAAA', 'est-1'), ConflictException);
    await assert.rejects(servico.matricularEstudante('PAS-2026-7QK4', 'est-2'), ConflictException);
    assert.equal(tabelas.matricula.find((m) => m.id === 'mat-removida')?.status, 'removed');
  });

  it('professor nao entra por convite', async () => {
    await assert.rejects(
      servico.entrar('PAS-2026-7QK4', { id: 'prof-1', role: 'professor' }, async () => cadastro),
      ForbiddenException,
    );
  });
});

describe('cadastro novo pelo convite', () => {
  it('cria a conta e a matricula numa transacao e devolve o estudante autenticado', async () => {
    const resultado = await servico.entrar('PAS-2026-7QK4', undefined, async () => cadastro);
    const conta = tabelas.usuario.find((u) => u.id === resultado.estudante?.id)!;
    assert.equal(conta.email, 'carla.nova@catolicasc.edu.br');
    assert.equal(conta.passwordHash, 'hash:senha-forte');
    assert.equal(resultado.matricula.studentId, conta.id);
    assert.deepEqual(resultado.sessao, {
      accessToken: `jwt:${conta.id}`,
      refreshToken: `refresh:${conta.id}`,
    });
  });

  it('codigo invalido desfaz a conta criada na mesma transacao', async () => {
    const contas = tabelas.usuario.length;
    await assert.rejects(servico.cadastrarEMatricular('NAO-EXISTE', cadastro), NotFoundException);
    assert.equal(tabelas.usuario.length, contas);
  });

  it('recusa e-mail fora do dominio de estudante e e-mail ja cadastrado', async () => {
    await assert.rejects(
      servico.cadastrarEMatricular('PAS-2026-7QK4', { ...cadastro, email: 'carla@gmail.com' }),
      BadRequestException,
    );
    await assert.rejects(
      servico.cadastrarEMatricular('PAS-2026-7QK4', {
        ...cadastro,
        email: 'alice@catolicasc.edu.br',
      }),
      ConflictException,
    );
    assert.equal(tabelas.matricula.length, 1);
  });

  it('sem o login (#81), responde 501 sem gravar nada', async () => {
    const { banco, tabelas: semLogin } = criarBanco();
    const indisponivel = new ConvitesService(banco, new CredenciaisIndisponiveis());
    await assert.rejects(
      indisponivel.entrar('PAS-2026-7QK4', undefined, async () => cadastro),
      NotImplementedException,
    );
    assert.equal(semLogin.usuario.length, 3);
    assert.equal(semLogin.matricula.length, 1);
  });
});

describe('consulta do convite', () => {
  it('mostra turma e professor pelo codigo', async () => {
    assert.deepEqual(await servico.consultar('PAS-2026-7QK4'), {
      name: 'Arquitetura',
      subject: 'ES',
      term: '2026/1',
      teacherName: 'Helena Marques',
      status: 'active',
    });
    await assert.rejects(servico.consultar('NAO-EXISTE'), NotFoundException);
  });
});
