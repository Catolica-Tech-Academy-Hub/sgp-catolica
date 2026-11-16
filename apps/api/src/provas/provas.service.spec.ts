import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PROFESSOR_ATUAL_ID } from '../professor-atual';
import { ProvasService } from './provas.service';

function criarServico(statusInicial: 'draft' | 'ready' | 'closed') {
  const prova = {
    id: 'prova-1',
    teacherId: PROFESSOR_ATUAL_ID,
    title: 'Prova',
    description: null,
    status: statusInicial,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    blocos: null,
    questoes: [],
  };
  const turma = { id: 'turma-1', teacherId: PROFESSOR_ATUAL_ID };
  const aplicacoes: Array<Record<string, unknown>> = [];
  const banco = {
    prova: {
      findFirst: async () => ({ ...prova }),
      findUnique: async () => ({ teacherId: prova.teacherId }),
      updateMany: async ({
        data,
        where,
      }: {
        data: { status: typeof prova.status };
        where: { status?: { not: string } };
      }) => {
        if (where.status?.not === prova.status) return { count: 0 };
        prova.status = data.status;
        return { count: 1 };
      },
      upsert: async ({ update }: { update: Record<string, unknown> }) => ({
        ...prova,
        ...update,
        questoes: [],
      }),
    },
    questao: { findMany: async () => [] },
    questaoDaProva: { deleteMany: async () => ({ count: 0 }) },
    turma: {
      findFirst: async () => turma,
    },
    aplicacao: {
      create: async ({ data }: { data: Record<string, string> }) => {
        const aplicacao = {
          ...data,
          id: `aplicacao-${aplicacoes.length + 1}`,
          status: 'draft',
          pdfUrl: null,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        };
        aplicacoes.push(aplicacao);
        return aplicacao;
      },
    },
    $transaction: async <T>(executar: (tx: object) => Promise<T>) => executar(banco),
  };

  return {
    service: new ProvasService(banco as unknown as PrismaService),
    prova,
    aplicacoes,
  };
}

describe('ciclo de vida da prova', () => {
  it('muda de draft para ready ao criar a primeira aplicacao', async () => {
    const { service, prova, aplicacoes } = criarServico('draft');

    const aplicacao = await service.criarAplicacao('prova-1', 'turma-1');

    assert.equal(prova.status, 'ready');
    assert.equal(aplicacao.status, 'draft');
    assert.equal(aplicacoes.length, 1);
  });

  it('nao permite criar aplicacao para prova encerrada', async () => {
    const { service, prova, aplicacoes } = criarServico('closed');

    await assert.rejects(service.criarAplicacao('prova-1', 'turma-1'), ConflictException);

    assert.equal(prova.status, 'closed');
    assert.equal(aplicacoes.length, 0);
  });

  it('encerra a prova e mantém o estado ao repetir a operação', async () => {
    const { service, prova } = criarServico('draft');

    const encerrada = await service.encerrar('prova-1');
    const encerradaNovamente = await service.encerrar('prova-1');

    assert.equal(prova.status, 'closed');
    assert.equal(encerrada.status, 'closed');
    assert.equal(encerradaNovamente.status, 'closed');
  });

  it('nao reabre uma prova encerrada ao salvar o conteudo', async () => {
    const { service } = criarServico('closed');

    const salva = await service.salvar('prova-1', {
      title: 'Prova revisada',
      status: 'ready',
      questions: [],
    });

    assert.equal(salva.status, 'closed');
  });
});
