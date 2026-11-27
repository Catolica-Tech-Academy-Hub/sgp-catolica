/**
 * Lancamento manual de nota (RF09, RNF09). Nos mocks, cor-3 a cor-6 sao da versao-3
 * (aplic-3, prova sem identificacao, turma-1) e ainda nao tem estudante.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { aplicacoesMock, correcoesMock, matriculasMock, versoesMock } from '@sgp/mocks';
import type { PrismaService } from '../prisma/prisma.service';
import { AtribuicaoService } from './atribuicao.service';

type Linha = Record<string, unknown>;

function criarBanco() {
  const correcoes: Linha[] = correcoesMock.map((c) => ({
    ...c,
    studentId: c.studentId ?? null,
    reportedStudentName: c.reportedStudentName ?? null,
    reportedStudentRegistration: c.reportedStudentRegistration ?? null,
    notes: c.notes ?? null,
    confirmedAt: new Date(c.confirmedAt),
  }));
  const matriculas = matriculasMock.map((m) => ({ ...m }));

  const aplicacaoDaVersao = (examVersionId: unknown) => {
    const versao = versoesMock.find((v) => v.id === examVersionId)!;
    return aplicacoesMock.find((a) => a.id === versao.applicationId)!;
  };
  const doProfessor = (c: Linha, professorId: string) =>
    aplicacaoDaVersao(c.examVersionId).teacherId === professorId;

  const banco = {
    aplicacao: {
      findFirst: async ({ where }: { where: { id: string; teacherId: string } }) =>
        aplicacoesMock.find((a) => a.id === where.id && a.teacherId === where.teacherId) ?? null,
    },
    matricula: {
      findFirst: async ({ where }: { where: Linha }) =>
        matriculas.find(
          (m) =>
            m.classId === where.classId &&
            m.studentId === where.studentId &&
            m.status === where.status,
        ) ?? null,
    },
    correcao: {
      findMany: async ({
        where,
      }: {
        where: {
          studentId?: null;
          versao: { applicationId?: string; aplicacao?: { teacherId: string } };
        };
      }) =>
        correcoes.filter((c) => {
          const aplicacao = aplicacaoDaVersao(c.examVersionId);
          if (where.versao.aplicacao && aplicacao.teacherId !== where.versao.aplicacao.teacherId) {
            return false;
          }
          if (where.versao.applicationId && aplicacao.id !== where.versao.applicationId) {
            return false;
          }
          return where.studentId === undefined || c.studentId === null;
        }),
      findFirst: async ({ where }: { where: Linha & { versao?: Linha } }) => {
        if (where.versao) {
          const { teacherId } = (where.versao as { aplicacao: { teacherId: string } }).aplicacao;
          const correcao = correcoes.find((c) => c.id === where.id && doProfessor(c, teacherId));
          return correcao
            ? {
                ...correcao,
                versao: {
                  aplicacao: { classId: aplicacaoDaVersao(correcao.examVersionId).classId },
                },
              }
            : null;
        }
        return (
          correcoes.find(
            (c) => c.examVersionId === where.examVersionId && c.studentId === where.studentId,
          ) ?? null
        );
      },
      update: async ({ where, data }: { where: { id: string }; data: Linha }) => {
        const correcao = correcoes.find((c) => c.id === where.id)!;
        Object.assign(correcao, data);
        return { ...correcao };
      },
    },
  };

  return { banco: banco as unknown as PrismaService, correcoes, matriculas };
}

let correcoes: Linha[];
let matriculas: { studentId: string; status: string }[];
let servico: AtribuicaoService;

beforeEach(() => {
  const criado = criarBanco();
  correcoes = criado.correcoes;
  matriculas = criado.matriculas;
  servico = new AtribuicaoService(criado.banco);
});

describe('atribuir', () => {
  it('preenche o estudante na correcao existente, sem criar registro novo', async () => {
    const antes = correcoes.length;
    const atribuida = await servico.atribuir('prof-1', 'cor-3', {
      studentId: 'est-3',
      notes: 'Nome conferido na lista de presenca.',
    });
    assert.equal(atribuida.id, 'cor-3');
    assert.equal(atribuida.studentId, 'est-3');
    assert.equal(atribuida.notes, 'Nome conferido na lista de presenca.');
    assert.equal(atribuida.isAutomaticallyAssigned, false);
    assert.equal(correcoes.length, antes);
  });

  it('recusa a segunda correcao da mesma versao para o mesmo estudante', async () => {
    await servico.atribuir('prof-1', 'cor-3', { studentId: 'est-3' });
    await assert.rejects(
      servico.atribuir('prof-1', 'cor-4', { studentId: 'est-3' }),
      ConflictException,
    );
    assert.equal(correcoes.find((c) => c.id === 'cor-4')?.studentId, null);
  });

  it('recusa correcao ja atribuida', async () => {
    await servico.atribuir('prof-1', 'cor-3', { studentId: 'est-3' });
    await assert.rejects(
      servico.atribuir('prof-1', 'cor-3', { studentId: 'est-2' }),
      ConflictException,
    );
  });

  it('recusa estudante sem matricula ativa na turma da aplicacao', async () => {
    await assert.rejects(
      servico.atribuir('prof-1', 'cor-3', { studentId: 'est-inexistente' }),
      BadRequestException,
    );
    matriculas.find((m) => m.studentId === 'est-2')!.status = 'removed';
    await assert.rejects(
      servico.atribuir('prof-1', 'cor-3', { studentId: 'est-2' }),
      BadRequestException,
    );
  });

  it('responde 404 para correcao de outro professor', async () => {
    await assert.rejects(
      servico.atribuir('prof-2', 'cor-3', { studentId: 'est-3' }),
      NotFoundException,
    );
  });
});

describe('desfazer atribuicao', () => {
  it('devolve a correcao atribuida manualmente para a fila', async () => {
    await servico.atribuir('prof-1', 'cor-3', { studentId: 'est-3' });
    const desfeita = await servico.desfazerAtribuicao('prof-1', 'cor-3');
    assert.equal(desfeita.studentId, undefined);
    assert.equal(correcoes.find((c) => c.id === 'cor-3')?.studentId, null);
  });

  it('nao tira o estudante de correcao atribuida pelo QR Code', async () => {
    await assert.rejects(servico.desfazerAtribuicao('prof-1', 'cor-1'), ConflictException);
    assert.equal(correcoes.find((c) => c.id === 'cor-1')?.studentId, 'est-1');
  });
});

describe('listagem', () => {
  it('pendentes da aplicacao trazem so as correcoes sem estudante', async () => {
    const pendentes = await servico.listarPendentes('prof-1', 'aplic-3');
    assert.deepEqual(pendentes.map((c) => c.id).sort(), ['cor-3', 'cor-4', 'cor-5', 'cor-6']);
    assert.ok(pendentes.every((c) => c.studentId === undefined));
  });

  it('pendentes de aplicacao de outro professor responde 404', async () => {
    await assert.rejects(servico.listarPendentes('prof-2', 'aplic-3'), NotFoundException);
  });

  it('lista todas as correcoes do professor e nenhuma de outro', async () => {
    assert.equal((await servico.listar('prof-1')).length, correcoesMock.length);
    assert.equal((await servico.listar('prof-2')).length, 0);
  });
});
