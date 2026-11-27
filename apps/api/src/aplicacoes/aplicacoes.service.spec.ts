import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AplicacoesService } from './aplicacoes.service';

const PROFESSOR_ATUAL_ID = 'prof-1';

function criarServico(opcoes?: { professorDaProva?: string; professorDaTurma?: string }) {
  const prova = {
    id: 'prova-1',
    teacherId: opcoes?.professorDaProva ?? PROFESSOR_ATUAL_ID,
    status: 'draft' as 'draft' | 'ready' | 'closed',
  };
  const turma = {
    id: 'turma-1',
    teacherId: opcoes?.professorDaTurma ?? PROFESSOR_ATUAL_ID,
  };
  const criadas: Array<Record<string, unknown>> = [];
  const existente = {
    id: 'aplicacao-existente',
    examId: 'prova-1',
    classId: 'turma-1',
    teacherId: PROFESSOR_ATUAL_ID,
    status: 'draft',
    pdfUrl: null,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
  };
  const banco = {
    prova: {
      findFirst: async ({ where }: { where: { id: string; teacherId: string } }) =>
        where.id === prova.id && where.teacherId === prova.teacherId ? { ...prova } : null,
      updateMany: async ({
        data,
        where,
      }: {
        data: { status: typeof prova.status };
        where: { id: string; teacherId: string; status: { not: string } };
      }) => {
        if (
          where.id !== prova.id ||
          where.teacherId !== prova.teacherId ||
          prova.status === where.status.not
        ) {
          return { count: 0 };
        }
        prova.status = data.status;
        return { count: 1 };
      },
    },
    turma: {
      findFirst: async ({ where }: { where: { id: string; teacherId: string } }) =>
        where.id === turma.id && where.teacherId === turma.teacherId ? { ...turma } : null,
    },
    aplicacao: {
      create: async ({ data }: { data: Record<string, string> }) => {
        const aplicacao = {
          ...data,
          id: `aplicacao-${criadas.length + 1}`,
          status: 'draft',
          pdfUrl: null,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        };
        criadas.push(aplicacao);
        return aplicacao;
      },
      findMany: async ({ where }: { where: { teacherId: string } }) =>
        where.teacherId === existente.teacherId ? [{ ...existente }] : [],
      findFirst: async ({ where }: { where: { id: string; teacherId: string } }) =>
        where.id === existente.id && where.teacherId === existente.teacherId
          ? { ...existente }
          : null,
    },
    $transaction: async <T>(executar: (tx: object) => Promise<T>) => executar(banco),
  };

  return {
    service: new AplicacoesService(banco as unknown as PrismaService),
    prova,
    criadas,
  };
}

describe('aplicacoes', () => {
  it('cria aplicacoes independentes em draft, inclusive para a mesma turma', async () => {
    const { service, prova, criadas } = criarServico();

    const primeira = await service.criar(PROFESSOR_ATUAL_ID, {
      examId: 'prova-1',
      classId: 'turma-1',
    });
    const segunda = await service.criar(PROFESSOR_ATUAL_ID, {
      examId: 'prova-1',
      classId: 'turma-1',
    });

    assert.equal(primeira.status, 'draft');
    assert.equal(segunda.status, 'draft');
    assert.notEqual(primeira.id, segunda.id);
    assert.equal(criadas.length, 2);
    assert.equal(prova.status, 'ready');
  });

  it('recusa prova que pertence a outro professor', async () => {
    const { service, criadas } = criarServico({ professorDaProva: 'professor-2' });

    await assert.rejects(
      service.criar(PROFESSOR_ATUAL_ID, { examId: 'prova-1', classId: 'turma-1' }),
      NotFoundException,
    );

    assert.equal(criadas.length, 0);
  });

  it('recusa turma que pertence a outro professor', async () => {
    const { service, criadas } = criarServico({ professorDaTurma: 'professor-2' });

    await assert.rejects(
      service.criar(PROFESSOR_ATUAL_ID, { examId: 'prova-1', classId: 'turma-1' }),
      NotFoundException,
    );

    assert.equal(criadas.length, 0);
  });

  it('nao cria aplicacao para prova encerrada', async () => {
    const { service, prova, criadas } = criarServico();
    prova.status = 'closed';

    await assert.rejects(
      service.criar(PROFESSOR_ATUAL_ID, { examId: 'prova-1', classId: 'turma-1' }),
      ConflictException,
    );

    assert.equal(criadas.length, 0);
  });

  it('lista apenas aplicacoes do professor atual', async () => {
    const { service } = criarServico();

    const aplicacoes = await service.listar(PROFESSOR_ATUAL_ID);

    assert.equal(aplicacoes.length, 1);
    assert.equal(aplicacoes[0].teacherId, PROFESSOR_ATUAL_ID);
  });

  it('consulta aplicacao do professor atual', async () => {
    const { service } = criarServico();

    const aplicacao = await service.obter(PROFESSOR_ATUAL_ID, 'aplicacao-existente');

    assert.equal(aplicacao.id, 'aplicacao-existente');
    assert.equal(aplicacao.teacherId, PROFESSOR_ATUAL_ID);
  });

  it('nao revela aplicacao que pertence a outro professor', async () => {
    const { service } = criarServico();

    await assert.rejects(
      service.obter(PROFESSOR_ATUAL_ID, 'aplicacao-de-outro-professor'),
      NotFoundException,
    );
  });
});
