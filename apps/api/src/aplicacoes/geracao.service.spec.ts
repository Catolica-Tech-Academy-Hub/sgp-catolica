import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { AtribuicaoVersao, LayoutVersao, VersaoProva } from '@sgp/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AplicacoesService } from './aplicacoes.service';
import { criarLayoutVersao, distribuirEstudantes } from './geracao.util';

const PROFESSOR_ATUAL_ID = 'prof-1';

type VersaoNoBanco = Omit<VersaoProva, 'createdAt' | 'answerKeyPublishedAt'> & {
  createdAt: Date;
  answerKeyPublishedAt: Date | null;
};

const questoes = [
  {
    questionId: 'q-1',
    questao: {
      type: 'objetiva' as const,
      alternativas: [{ id: 'q-1-a' }, { id: 'q-1-b' }, { id: 'q-1-c' }],
    },
  },
  {
    questionId: 'q-2',
    questao: { type: 'discursiva' as const, alternativas: [] },
  },
  {
    questionId: 'q-3',
    questao: { type: 'objetiva' as const, alternativas: [{ id: 'q-3-a' }, { id: 'q-3-b' }] },
  },
];

function criarServico(opcoes?: {
  applicationOwner?: string;
  status?: 'draft' | 'generated' | 'closed';
  corrections?: number;
  students?: string[];
  existingVersions?: string[];
}) {
  const aplicacao = {
    id: 'aplic-1',
    examId: 'prova-1',
    classId: 'turma-1',
    teacherId: opcoes?.applicationOwner ?? PROFESSOR_ATUAL_ID,
    status: opcoes?.status ?? ('draft' as const),
    pdfUrl: 'pdf-antigo',
  };
  const versoes: VersaoNoBanco[] = (opcoes?.existingVersions ?? []).map((id, indice) => ({
    id,
    applicationId: aplicacao.id,
    versionNumber: indice + 1,
    shuffleQuestions: false,
    shuffleAlternatives: false,
    withStudentIdentification: true,
    layout: { questionOrder: [], alternativeOrder: [] },
    answerKeyPublished: false,
    answerKeyPublishedAt: null,
    publicCode: `GAB-${id}`,
    qrCodePayload: `sgp:v1:version:${id}`,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
  }));
  const atribuicoes: AtribuicaoVersao[] = versoes.map((versao, indice) => ({
    id: `atr-${indice + 1}`,
    examVersionId: versao.id,
    studentId: `est-${indice + 1}`,
    qrCodePayload: `sgp:v1:version:${versao.id}:student:est-${indice + 1}`,
  }));
  const banco = {
    aplicacao: {
      findFirst: async () => (aplicacao.teacherId === PROFESSOR_ATUAL_ID ? { ...aplicacao } : null),
      update: async ({ data }: { data: { status: 'draft'; pdfUrl: null } }) => {
        Object.assign(aplicacao, data);
        return { ...aplicacao };
      },
    },
    versaoProva: {
      findMany: async () => versoes.map(({ id }) => ({ id })),
      deleteMany: async () => {
        const quantidade = versoes.length;
        versoes.splice(0, versoes.length);
        atribuicoes.splice(0, atribuicoes.length);
        return { count: quantidade };
      },
      create: async ({
        data,
      }: {
        data: {
          id: string;
          applicationId: string;
          versionNumber: number;
          shuffleQuestions: boolean;
          shuffleAlternatives: boolean;
          withStudentIdentification: boolean;
          layout: LayoutVersao;
          publicCode: string;
          qrCodePayload: string;
        };
      }) => {
        const versao: VersaoNoBanco = {
          ...data,
          answerKeyPublished: false,
          answerKeyPublishedAt: null,
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
        };
        versoes.push(versao);
        return versao;
      },
    },
    correcao: {
      count: async () => opcoes?.corrections ?? 0,
    },
    prova: {
      findFirst: async () => ({
        questoes: questoes.map((questao) => ({ ...questao })),
      }),
    },
    matricula: {
      findMany: async () =>
        (opcoes?.students ?? ['est-1', 'est-2', 'est-3']).map((studentId) => ({ studentId })),
    },
    atribuicaoVersao: {
      createMany: async ({ data }: { data: AtribuicaoVersao[] }) => {
        atribuicoes.push(...data);
        return { count: data.length };
      },
    },
    $transaction: async <T>(executar: (tx: object) => Promise<T>) => executar(banco),
  };

  return {
    service: new AplicacoesService(banco as unknown as PrismaService),
    aplicacao,
    versoes,
    atribuicoes,
  };
}

describe('geracao de versoes', () => {
  it('materializa ordem das questoes e alternativas de forma deterministica', () => {
    const layout = criarLayoutVersao(
      [
        { questionId: 'q-1', type: 'objetiva', alternativeIds: ['a', 'b', 'c'] },
        { questionId: 'q-2', type: 'discursiva', alternativeIds: [] },
        { questionId: 'q-3', type: 'objetiva', alternativeIds: ['x', 'y'] },
      ],
      true,
      true,
      () => 0,
    );

    assert.deepEqual(layout, {
      questionOrder: ['q-2', 'q-3', 'q-1'],
      alternativeOrder: [
        { questionId: 'q-3', printedOrder: ['y', 'x'] },
        { questionId: 'q-1', printedOrder: ['b', 'c', 'a'] },
      ],
    });
  });

  it('persiste a ordem original mesmo sem embaralhar alternativas', () => {
    const layout = criarLayoutVersao(
      [
        { questionId: 'q-1', type: 'objetiva', alternativeIds: ['a', 'b', 'c'] },
        { questionId: 'q-2', type: 'discursiva', alternativeIds: [] },
      ],
      false,
      false,
    );

    assert.deepEqual(layout, {
      questionOrder: ['q-1', 'q-2'],
      alternativeOrder: [{ questionId: 'q-1', printedOrder: ['a', 'b', 'c'] }],
    });
  });

  it('distribui alunos de forma aleatoria e balanceada entre versoes', () => {
    const distribuicao = distribuirEstudantes(
      ['est-1', 'est-2', 'est-3', 'est-4', 'est-5'],
      ['versao-1', 'versao-2'],
      () => 0,
    );
    const quantidades = ['versao-1', 'versao-2'].map(
      (id) => distribuicao.filter((item) => item.examVersionId === id).length,
    );

    assert.equal(distribuicao.length, 5);
    assert.equal(new Set(distribuicao.map((item) => item.studentId)).size, 5);
    assert.ok(Math.max(...quantidades) - Math.min(...quantidades) <= 1);
    assert.equal(distribuicao.filter((item) => item.examVersionId === 'versao-1').length, 2);
  });

  it('cria versoes com QR distinto do codigo publico e uma atribuicao por aluno', async () => {
    const { service, versoes, atribuicoes, aplicacao } = criarServico();

    const resultado = await service.gerarVersoes(PROFESSOR_ATUAL_ID, 'aplic-1', {
      quantity: 2,
      shuffleQuestions: true,
      shuffleAlternatives: true,
      withStudentIdentification: true,
    });

    assert.equal(resultado.versions.length, 2);
    assert.equal(resultado.assignments.length, 3);
    assert.equal(versoes.length, 2);
    assert.equal(atribuicoes.length, 3);
    assert.equal(new Set(resultado.assignments.map((item) => item.studentId)).size, 3);
    assert.ok(resultado.versions.every((versao) => versao.qrCodePayload !== versao.publicCode));
    assert.ok(
      resultado.assignments.every((item) =>
        item.qrCodePayload.startsWith(`sgp:v1:version:${item.examVersionId}:student:`),
      ),
    );
    assert.equal(aplicacao.status, 'draft');
  });

  it('gera versoes anonimas sem atribuicoes e com QR identificando apenas a versao', async () => {
    const { service } = criarServico();

    const resultado = await service.gerarVersoes(PROFESSOR_ATUAL_ID, 'aplic-1', {
      quantity: 1,
      shuffleQuestions: false,
      shuffleAlternatives: false,
      withStudentIdentification: false,
    });

    assert.equal(resultado.assignments.length, 0);
    assert.equal(resultado.versions[0].qrCodePayload, `sgp:v1:version:${resultado.versions[0].id}`);
  });

  it('bloqueia a regeneracao apos correcao confirmada sem substituir os dados atuais', async () => {
    const { service, versoes, atribuicoes } = criarServico({
      status: 'generated',
      corrections: 1,
      existingVersions: ['versao-antiga'],
    });

    await assert.rejects(
      service.gerarVersoes(PROFESSOR_ATUAL_ID, 'aplic-1', {
        quantity: 1,
        shuffleQuestions: false,
        shuffleAlternatives: false,
        withStudentIdentification: true,
      }),
      ConflictException,
    );

    assert.equal(versoes[0].id, 'versao-antiga');
    assert.equal(atribuicoes.length, 1);
  });

  it('substitui versoes anteriores e invalida o PDF ao regenerar sem correcoes', async () => {
    const { service, versoes, atribuicoes, aplicacao } = criarServico({
      status: 'generated',
      existingVersions: ['versao-antiga'],
    });

    const resultado = await service.gerarVersoes(PROFESSOR_ATUAL_ID, 'aplic-1', {
      quantity: 1,
      shuffleQuestions: false,
      shuffleAlternatives: false,
      withStudentIdentification: true,
    });

    assert.equal(versoes.length, 1);
    assert.notEqual(versoes[0].id, 'versao-antiga');
    assert.equal(
      atribuicoes.some((item) => item.examVersionId === 'versao-antiga'),
      false,
    );
    assert.equal(aplicacao.status, 'draft');
    assert.equal(aplicacao.pdfUrl, null);
    assert.equal(resultado.versions[0].versionNumber, 1);
  });

  it('recusa geracao identificada sem estudantes ativos', async () => {
    const { service, versoes } = criarServico({ students: [] });

    await assert.rejects(
      service.gerarVersoes(PROFESSOR_ATUAL_ID, 'aplic-1', {
        quantity: 1,
        shuffleQuestions: false,
        shuffleAlternatives: false,
        withStudentIdentification: true,
      }),
      BadRequestException,
    );

    assert.equal(versoes.length, 0);
  });

  it('nao expoe aplicacoes de outro professor', async () => {
    const { service, versoes } = criarServico({ applicationOwner: 'professor-2' });

    await assert.rejects(
      service.gerarVersoes(PROFESSOR_ATUAL_ID, 'aplic-1', {
        quantity: 1,
        shuffleQuestions: false,
        shuffleAlternatives: false,
        withStudentIdentification: false,
      }),
      NotFoundException,
    );

    assert.equal(versoes.length, 0);
  });
});
