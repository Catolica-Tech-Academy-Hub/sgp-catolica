/**
 * Sincronizacao em lote (RF08, RNF09): idempotencia, conflito, recalculo por snapshot e
 * identificacao. O banco em memoria e semeado com os mesmos mocks do seed e responde so
 * as consultas que `CorrecoesService` faz.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  aplicacoesMock,
  atribuicoesMock,
  correcoesMock,
  filaCorrecoesMock,
  provasMock,
  questoesMock,
  versoesMock,
} from '@sgp/mocks';
import type { ItemFilaCorrecao } from '@sgp/shared-types';
import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { CorrecoesService } from './correcoes.service';

type Linha = Record<string, unknown>;

function criarBanco() {
  const questoes = questoesMock.map((q) => ({
    ...q,
    correctAlternativeId: q.correctAlternativeId ?? null,
  }));
  const correcoes: Linha[] = correcoesMock.map((c) => ({
    ...c,
    studentId: c.studentId ?? null,
    reviewReason: null,
  }));

  function versaoCompleta(id: string) {
    const versao = versoesMock.find((v) => v.id === id);
    if (!versao) return undefined;
    const aplicacao = aplicacoesMock.find((a) => a.id === versao.applicationId)!;
    const prova = provasMock.find((p) => p.id === aplicacao.examId)!;
    return {
      ...versao,
      aplicacao: {
        ...aplicacao,
        prova: {
          ...prova,
          questoes: prova.questions.map(({ questionId, score }) => {
            const questao = questoes.find((q) => q.id === questionId)!;
            return {
              score,
              questao: {
                ...questao,
                alternativas: (questao.alternatives ?? []).map((a, position) => ({
                  ...a,
                  position,
                })),
              },
            };
          }),
        },
      },
    };
  }

  const aplicacaoDaVersao = (id: unknown) =>
    aplicacoesMock.find((a) => a.id === versoesMock.find((v) => v.id === id)?.applicationId);

  const banco = {
    versaoProva: {
      findFirst: async ({ where }: { where: { id: string; aplicacao: { teacherId: string } } }) => {
        const versao = versaoCompleta(where.id);
        return versao && versao.aplicacao.teacherId === where.aplicacao.teacherId ? versao : null;
      },
    },
    atribuicaoVersao: {
      findFirst: async ({ where }: { where: { examVersionId: string; studentId: string } }) =>
        atribuicoesMock.find(
          (a) => a.examVersionId === where.examVersionId && a.studentId === where.studentId,
        ) ?? null,
    },
    correcao: {
      findUnique: async ({ where }: { where: { clientCorrectionId: string } }) => {
        const correcao = correcoes.find((c) => c.clientCorrectionId === where.clientCorrectionId);
        if (!correcao) return null;
        return {
          ...correcao,
          versao: {
            aplicacao: { teacherId: aplicacaoDaVersao(correcao.examVersionId)!.teacherId },
          },
        };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { examVersionId: string; studentId: string };
        data: Linha;
      }) => {
        const alvo = correcoes.filter(
          (c) => c.examVersionId === where.examVersionId && c.studentId === where.studentId,
        );
        for (const correcao of alvo) Object.assign(correcao, data);
        return { count: alvo.length };
      },
      create: async ({ data }: { data: Linha }) => {
        const duplicada = correcoes.some(
          (c) =>
            c.clientCorrectionId === data.clientCorrectionId ||
            (data.studentId !== null &&
              c.examVersionId === data.examVersionId &&
              c.studentId === data.studentId),
        );
        if (duplicada) {
          throw new Prisma.PrismaClientKnownRequestError('Unico.', {
            code: 'P2002',
            clientVersion: 'teste',
          });
        }
        const correcao = { ...data, id: `cor-nova-${correcoes.length + 1}` };
        correcoes.push(correcao);
        return correcao;
      },
    },
  };

  return { banco: banco as unknown as PrismaService, correcoes };
}

function copia<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

/** Item novo a partir de um dos mocks da fila, com outro identificador. */
function itemNovo(base: string, mudancas: Partial<ItemFilaCorrecao> = {}): ItemFilaCorrecao {
  const item = copia(filaCorrecoesMock.find((i) => i.clientCorrectionId === base)!);
  return { ...item, clientCorrectionId: `novo-${Math.random()}`, ...mudancas };
}

let correcoes: Linha[];
let servico: CorrecoesService;

beforeEach(() => {
  const criado = criarBanco();
  correcoes = criado.correcoes;
  servico = new CorrecoesService(criado.banco);
});

/**
 * Item de um aluno da versao-1 (com identificacao) ainda sem correcao. Nos mocks todos ja
 * foram corrigidos, entao a correcao de est-1 sai do banco em memoria antes.
 */
function itemDeEstudanteSemCorrecao(mudancas: Partial<ItemFilaCorrecao> = {}) {
  const indice = correcoes.findIndex(
    (c) => c.examVersionId === 'versao-1' && c.studentId === 'est-1',
  );
  if (indice >= 0) correcoes.splice(indice, 1);
  return itemNovo('c1f3a8de-0001', { studentId: 'est-1', ...mudancas });
}

describe('idempotencia', () => {
  it('reenvio de item ja registrado devolve o registro existente sem criar outro', async () => {
    const antes = correcoes.length;
    const reenviado = copia(
      filaCorrecoesMock.find((i) => i.clientCorrectionId === 'c1f3a8de-0001')!,
    );
    const [resultado] = await servico.sincronizarLote('prof-1', [reenviado]);
    assert.equal(resultado.syncStatus, 'synced');
    assert.equal(resultado.correctionId, 'cor-1');
    assert.equal(correcoes.length, antes);
  });

  it('o mesmo item enviado duas vezes no lote grava uma vez', async () => {
    const item = itemDeEstudanteSemCorrecao();
    const antes = correcoes.length;
    const [primeiro, segundo] = await servico.sincronizarLote('prof-1', [item, copia(item)]);
    assert.equal(primeiro.syncStatus, 'synced');
    assert.equal(segundo.syncStatus, 'synced');
    assert.equal(segundo.correctionId, primeiro.correctionId);
    assert.equal(correcoes.length, antes + 1);
  });

  it('nao revela item de outro professor', async () => {
    const reenviado = copia(
      filaCorrecoesMock.find((i) => i.clientCorrectionId === 'c1f3a8de-0001')!,
    );
    const [resultado] = await servico.sincronizarLote('prof-2', [reenviado]);
    assert.equal(resultado.syncStatus, 'error');
    assert.equal(resultado.correctionId, undefined);
  });
});

describe('conflito', () => {
  it('segunda correcao do mesmo aluno e versao mantem a primeira e a marca para revisao', async () => {
    const primeira = correcoes.find((c) => c.id === 'cor-1')!;
    const notaOriginal = primeira.totalScore;
    const [resultado] = await servico.sincronizarLote('prof-1', [
      itemNovo('c1f3a8de-0001', { studentId: 'est-1' }),
    ]);
    assert.equal(resultado.syncStatus, 'error');
    assert.match(resultado.syncError ?? '', /primeira foi mantida/);
    assert.equal(primeira.totalScore, notaOriginal);
    assert.equal(primeira.reviewReason, 'duplicate_submission');
  });
});

describe('recalculo por snapshot', () => {
  it('gabarito atual igual ao snapshot: sincroniza sem revisao', async () => {
    const [resultado] = await servico.sincronizarLote('prof-1', [itemDeEstudanteSemCorrecao()]);
    assert.equal(resultado.syncStatus, 'synced');
    assert.equal(resultado.totalScore, 7.5);
    assert.equal(resultado.reviewReason, undefined);
  });

  it('gabarito mudou: grava a nota do snapshot e sinaliza o professor', async () => {
    const item = itemDeEstudanteSemCorrecao();
    const q4 = item.answerKeySnapshot.objectiveQuestions.find((q) => q.questionId === 'q-4')!;
    q4.correctAlternativeId = 'q-4-c';
    const [resultado] = await servico.sincronizarLote('prof-1', [item]);
    assert.equal(resultado.syncStatus, 'synced');
    assert.equal(resultado.totalScore, 9.5);
    assert.equal(resultado.reviewReason, 'answer_key_changed');
    const gravada = correcoes.find((c) => c.id === resultado.correctionId)!;
    assert.equal(gravada.reviewReason, 'answer_key_changed');
    assert.deepEqual(gravada.answerKeySnapshot, item.answerKeySnapshot);
  });

  it('snapshot com questoes que nao sao as da folha e recusado', async () => {
    const item = itemDeEstudanteSemCorrecao();
    item.answerKeySnapshot.discursiveQuestions.pop();
    item.discursiveScores.pop();
    const [resultado] = await servico.sincronizarLote('prof-1', [item]);
    assert.equal(resultado.syncStatus, 'error');
  });
});

describe('identificacao', () => {
  it('prova sem identificacao grava sem estudante, com nome e matricula lidos', async () => {
    const [resultado] = await servico.sincronizarLote('prof-1', [itemNovo('c1f3a8de-0003')]);
    assert.equal(resultado.syncStatus, 'synced');
    const gravada = correcoes.find((c) => c.id === resultado.correctionId)!;
    assert.equal(gravada.studentId, null);
    assert.equal(gravada.isAutomaticallyAssigned, false);
    assert.equal(gravada.reportedStudentName, 'Clara A.');
    assert.equal(gravada.reportedStudentRegistration, '2026103');
  });

  it('prova sem identificacao nao aceita estudante', async () => {
    const [resultado] = await servico.sincronizarLote('prof-1', [
      itemNovo('c1f3a8de-0003', { studentId: 'est-1' }),
    ]);
    assert.equal(resultado.syncStatus, 'error');
  });

  it('prova com identificacao exige estudante que recebeu a versao', async () => {
    const semAluno = itemNovo('c1f3a8de-0001', { studentId: undefined });
    const alunoDeFora = itemNovo('c1f3a8de-0001', { studentId: 'est-inexistente' });
    const resultados = await servico.sincronizarLote('prof-1', [semAluno, alunoDeFora]);
    assert.deepEqual(
      resultados.map((r) => r.syncStatus),
      ['error', 'error'],
    );
  });

  it('versao de outro professor responde como inexistente', async () => {
    const [resultado] = await servico.sincronizarLote('prof-2', [itemNovo('c1f3a8de-0003')]);
    assert.equal(resultado.syncStatus, 'error');
    assert.equal(resultado.syncError, 'Versao nao encontrada.');
  });
});

describe('status por item', () => {
  it('item invalido vira erro so dele, e os outros do lote sincronizam', async () => {
    const resultados = await servico.sincronizarLote('prof-1', [
      { clientCorrectionId: 'quebrado' },
      itemNovo('c1f3a8de-0003'),
      'nem objeto',
    ]);
    assert.deepEqual(
      resultados.map((r) => [r.clientCorrectionId, r.syncStatus]),
      [
        ['quebrado', 'error'],
        [resultados[1].clientCorrectionId, 'synced'],
        [undefined, 'error'],
      ],
    );
  });
});
