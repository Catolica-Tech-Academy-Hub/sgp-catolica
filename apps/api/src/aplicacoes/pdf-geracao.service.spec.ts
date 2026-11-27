import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AplicacoesService } from './aplicacoes.service';

const PROFESSOR_ATUAL_ID = 'prof-1';

const opcoes = {
  quantity: 1,
  shuffleQuestions: false,
  shuffleAlternatives: false,
  withStudentIdentification: true,
};

function criarServico(estudantes = ['estudante-1']) {
  const aplicacao: Record<string, unknown> = {
    id: 'aplicacao-pdf',
    examId: 'prova-pdf',
    classId: 'turma-pdf',
    teacherId: PROFESSOR_ATUAL_ID,
    status: 'draft',
    pdfUrl: null,
    pdfContent: null,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
  };
  const questao = {
    id: 'questao-1',
    type: 'objetiva',
    statement: 'Quanto é 2 + 2?',
    alternativas: [
      { id: 'alternativa-a', text: '4' },
      { id: 'alternativa-b', text: '5' },
    ],
  };
  const blocos: Array<Record<string, unknown>> = [
    { type: 'questao', questionId: questao.id, formatoResposta: 'objetiva' },
  ];
  const versoes: Array<Record<string, unknown>> = [];
  const atribuicoes: Array<Record<string, unknown>> = [];

  const banco = {
    aplicacao: {
      findFirst: async () => ({ ...aplicacao }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(aplicacao, data);
        return { ...aplicacao };
      },
    },
    versaoProva: {
      findMany: async (consulta: Record<string, unknown>) => {
        if ('include' in consulta) {
          return versoes.map((versao) => ({
            ...versao,
            atribuicoes: atribuicoes
              .filter((atribuicao) => atribuicao.examVersionId === versao.id)
              .map((atribuicao) => ({
                ...atribuicao,
                estudante: {
                  id: atribuicao.studentId,
                  fullName: 'Estudante Ficticio',
                  registration: 'MAT-001',
                },
              })),
          }));
        }
        return versoes.map((versao) => ({ id: versao.id }));
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const versao = {
          ...data,
          answerKeyPublished: false,
          answerKeyPublishedAt: null,
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
        };
        versoes.push(versao);
        return versao;
      },
      deleteMany: async () => {
        const quantidade = versoes.length;
        versoes.splice(0, versoes.length);
        atribuicoes.splice(0, atribuicoes.length);
        return { count: quantidade };
      },
    },
    correcao: { count: async () => 0 },
    prova: {
      findFirst: async () => ({
        title: 'Prova de demonstração',
        description: 'Avaliação fictícia',
        totalScore: 2,
        blocos,
        questoes: [
          {
            questionId: questao.id,
            score: { toString: () => '2' },
            questao: {
              ...questao,
              alternativas: questao.alternativas.map((alternativa) => ({ ...alternativa })),
            },
          },
        ],
      }),
    },
    turma: { findFirst: async () => ({ name: 'Turma de demonstração', subject: 'Matemática' }) },
    usuario: { findFirst: async () => ({ fullName: 'Professora Fictícia' }) },
    matricula: {
      findMany: async () => estudantes.map((studentId) => ({ studentId })),
    },
    atribuicaoVersao: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        atribuicoes.push(...data);
        return { count: data.length };
      },
    },
    $transaction: async <T>(executar: (tx: object) => Promise<T>) => executar(banco),
  };

  return {
    service: new AplicacoesService(banco as unknown as PrismaService),
    aplicacao,
    blocos,
    versoes,
    atribuicoes,
  };
}

describe('geracao de PDF da aplicação', () => {
  it('persiste o PDF, marca generated e permite baixar o mesmo conteúdo', async () => {
    const { service, aplicacao, versoes, atribuicoes } = criarServico();

    const resultado = await service.gerarPdf(PROFESSOR_ATUAL_ID, 'aplicacao-pdf', opcoes);
    const pdf = await service.obterPdf(PROFESSOR_ATUAL_ID, 'aplicacao-pdf');

    assert.equal(resultado.application.status, 'generated');
    assert.equal(resultado.application.pdfUrl, '/aplicacoes/aplicacao-pdf/pdf');
    assert.equal(versoes.length, 1);
    assert.equal(atribuicoes.length, 1);
    assert.equal(aplicacao.status, 'generated');
    assert.equal(aplicacao.pdfUrl, '/aplicacoes/aplicacao-pdf/pdf');
    assert.equal(aplicacao.pdfContent instanceof Uint8Array, true);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length, 2);
    assert.deepEqual(pdf, Buffer.from(aplicacao.pdfContent as Uint8Array));
  });

  it('inclui uma cópia e cartão-resposta para cada atribuição identificada', async () => {
    const { service, atribuicoes } = criarServico(['estudante-1', 'estudante-2']);

    await service.gerarPdf(PROFESSOR_ATUAL_ID, 'aplicacao-pdf', opcoes);
    const pdf = await service.obterPdf(PROFESSOR_ATUAL_ID, 'aplicacao-pdf');

    assert.equal(atribuicoes.length, 2);
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length, 4);
  });

  it('substitui o PDF e as versões ao regenerar sem correções confirmadas', async () => {
    const { service, aplicacao, versoes } = criarServico();

    await service.gerarPdf(PROFESSOR_ATUAL_ID, 'aplicacao-pdf', opcoes);
    const primeiroPdf = await service.obterPdf(PROFESSOR_ATUAL_ID, 'aplicacao-pdf');
    const primeiraVersao = versoes[0].id;

    await service.gerarPdf(PROFESSOR_ATUAL_ID, 'aplicacao-pdf', opcoes);
    const segundoPdf = await service.obterPdf(PROFESSOR_ATUAL_ID, 'aplicacao-pdf');

    assert.equal(aplicacao.status, 'generated');
    assert.equal(versoes.length, 1);
    assert.notEqual(versoes[0].id, primeiraVersao);
    assert.notDeepEqual(segundoPdf, primeiroPdf);
  });

  it('mantem a aplicação fora de generated se o PDF não puder ser renderizado', async () => {
    const { service, aplicacao, blocos } = criarServico();
    blocos[0].questionId = 'rascunho-nao-salvo';

    await assert.rejects(
      service.gerarPdf(PROFESSOR_ATUAL_ID, 'aplicacao-pdf', opcoes),
      BadRequestException,
    );

    assert.equal(aplicacao.status, 'draft');
    assert.equal(aplicacao.pdfContent, null);
    assert.equal(aplicacao.pdfUrl, null);
  });

  it('recusa bloco que não cabe inteiro na área útil A4', async () => {
    const { service, aplicacao, blocos } = criarServico();
    blocos.push({ type: 'texto', conteudo: 'Conteúdo longo. '.repeat(20_000) });

    await assert.rejects(
      service.gerarPdf(PROFESSOR_ATUAL_ID, 'aplicacao-pdf', opcoes),
      BadRequestException,
    );

    assert.equal(aplicacao.status, 'draft');
    assert.equal(aplicacao.pdfContent, null);
  });
});
