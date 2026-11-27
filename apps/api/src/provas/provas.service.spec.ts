import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaService } from '../prisma/prisma.service';
import { ProvasService } from './provas.service';

const PROFESSOR_ATUAL_ID = 'prof-1';

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
    $transaction: async <T>(executar: (tx: object) => Promise<T>) => executar(banco),
  };

  return { service: new ProvasService(banco as unknown as PrismaService), prova };
}

describe('ciclo de vida da prova', () => {
  it('encerra a prova e mantém o estado ao repetir a operação', async () => {
    const { service, prova } = criarServico('draft');

    const encerrada = await service.encerrar(PROFESSOR_ATUAL_ID, 'prova-1');
    const encerradaNovamente = await service.encerrar(PROFESSOR_ATUAL_ID, 'prova-1');

    assert.equal(prova.status, 'closed');
    assert.equal(encerrada.status, 'closed');
    assert.equal(encerradaNovamente.status, 'closed');
  });

  it('nao reabre uma prova encerrada ao salvar o conteudo', async () => {
    const { service } = criarServico('closed');

    const salva = await service.salvar(PROFESSOR_ATUAL_ID, 'prova-1', {
      title: 'Prova revisada',
      status: 'ready',
      questions: [],
    });

    assert.equal(salva.status, 'closed');
  });
});
