import type { Aplicacao, AtribuicaoVersao, Prova, VersaoProva } from '@sgp/shared-types';
import { estudantesMock } from './usuarios';

export const provasMock: Prova[] = [
  {
    /** Arquivada: nao aceita novas aplicacoes, mas a aplicacao existente segue valendo (RF04). */
    id: 'prova-0',
    teacherId: 'prof-1',
    title: 'Diagnostica - Fundamentos',
    description: 'Avaliacao diagnostica aplicada no inicio do periodo.',
    questions: [
      { questionId: 'q-1', order: 1, score: 3 },
      { questionId: 'q-2', order: 2, score: 3 },
      { questionId: 'q-3', order: 3, score: 4 },
    ],
    status: 'closed',
    createdAt: '2026-03-02T12:00:00.000Z',
  },
  {
    id: 'prova-1',
    teacherId: 'prof-1',
    title: 'Avaliacao 01 - Arquitetura e Requisitos',
    description: 'Conteudo das aulas 1 a 8.',
    questions: [
      { questionId: 'q-1', order: 1, score: 1.5 },
      { questionId: 'q-3', order: 2, score: 1.5 },
      { questionId: 'q-4', order: 3, score: 2 },
      { questionId: 'q-5', order: 4, score: 2 },
      { questionId: 'q-6', order: 5, score: 3 },
    ],
    status: 'ready',
    createdAt: '2026-03-15T12:00:00.000Z',
  },
  {
    id: 'prova-2',
    teacherId: 'prof-1',
    title: 'Avaliacao 02 - Modelagem de Dados',
    description: 'MER/DER e normalizacao.',
    questions: [
      { questionId: 'q-2', order: 1, score: 4 },
      { questionId: 'q-5', order: 2, score: 6 },
    ],
    status: 'draft',
    createdAt: '2026-04-02T12:00:00.000Z',
  },
];

export const aplicacoesMock: Aplicacao[] = [
  {
    id: 'aplic-0',
    examId: 'prova-0',
    classId: 'turma-1',
    teacherId: 'prof-1',
    status: 'generated',
    pdfUrl: 'mock://aplicacoes/aplic-0.pdf',
    createdAt: '2026-03-04T12:00:00.000Z',
  },
  {
    id: 'aplic-1',
    examId: 'prova-1',
    classId: 'turma-1',
    teacherId: 'prof-1',
    status: 'generated',
    pdfUrl: 'mock://aplicacoes/aplic-1.pdf',
    createdAt: '2026-04-10T12:00:00.000Z',
  },
  {
    id: 'aplic-2',
    examId: 'prova-1',
    classId: 'turma-2',
    teacherId: 'prof-1',
    status: 'draft',
    createdAt: '2026-04-18T12:00:00.000Z',
  },
  {
    /**
     * Segunda chamada de prova-1 para a mesma turma. Aplicacoes sao independentes
     * entre si (RF05). Esta foi gerada SEM identificacao do aluno, entao a nota
     * depende de lancamento manual (RF09).
     */
    id: 'aplic-3',
    examId: 'prova-1',
    classId: 'turma-1',
    teacherId: 'prof-1',
    status: 'generated',
    pdfUrl: 'mock://aplicacoes/aplic-3.pdf',
    createdAt: '2026-04-15T12:00:00.000Z',
  },
  {
    /**
     * Terceira aplicacao de prova-1 na turma-1, ja corrigida mas com o gabarito
     * AINDA NAO publicado. Existe para o historico do estudante poder demonstrar a
     * regra do RF11: sem gabarito publicado, nao ha detalhamento por questao.
     */
    id: 'aplic-4',
    examId: 'prova-1',
    classId: 'turma-1',
    teacherId: 'prof-1',
    status: 'generated',
    pdfUrl: 'mock://aplicacoes/aplic-4.pdf',
    createdAt: '2026-05-12T12:00:00.000Z',
  },
];

export const versoesMock: VersaoProva[] = [
  {
    id: 'versao-0',
    applicationId: 'aplic-0',
    versionNumber: 1,
    shuffleQuestions: false,
    shuffleAlternatives: false,
    withStudentIdentification: true,
    layout: {
      questionOrder: ['q-1', 'q-2', 'q-3'],
      alternativeOrder: [],
    },
    answerKeyPublished: true,
    answerKeyPublishedAt: '2026-03-12T18:00:00.000Z',
    publicCode: 'GAB-0X9Y8Z',
    qrCodePayload: 'mock-qr-versao-0',
    createdAt: '2026-03-05T12:00:00.000Z',
  },
  {
    id: 'versao-1',
    applicationId: 'aplic-1',
    versionNumber: 1,
    shuffleQuestions: true,
    shuffleAlternatives: true,
    withStudentIdentification: true,
    layout: {
      questionOrder: ['q-3', 'q-1', 'q-4', 'q-6', 'q-5'],
      alternativeOrder: [
        { questionId: 'q-1', printedOrder: ['q-1-c', 'q-1-a', 'q-1-d', 'q-1-b'] },
        { questionId: 'q-3', printedOrder: ['q-3-d', 'q-3-b', 'q-3-a', 'q-3-c'] },
        { questionId: 'q-4', printedOrder: ['q-4-b', 'q-4-a', 'q-4-c', 'q-4-d'] },
      ],
    },
    answerKeyPublished: true,
    answerKeyPublishedAt: '2026-04-24T18:00:00.000Z',
    publicCode: 'GAB-1A2B3C',
    qrCodePayload: 'mock-qr-versao-1',
    createdAt: '2026-04-11T12:00:00.000Z',
  },
  {
    id: 'versao-2',
    applicationId: 'aplic-1',
    versionNumber: 2,
    shuffleQuestions: true,
    shuffleAlternatives: false,
    withStudentIdentification: true,
    layout: {
      questionOrder: ['q-4', 'q-3', 'q-1', 'q-5', 'q-6'],
      alternativeOrder: [],
    },
    answerKeyPublished: false,
    publicCode: 'GAB-4D5E6F',
    qrCodePayload: 'mock-qr-versao-2',
    createdAt: '2026-04-11T12:00:00.000Z',
  },
  {
    /**
     * Prova anonima (RF06): o QR Code identifica somente a versao, nunca o aluno.
     * Por isso esta versao nao tem nenhuma AtribuicaoVersao associada, e a nota
     * calculada pelo aplicativo fica pendente de atribuicao manual (RF09).
     */
    id: 'versao-3',
    applicationId: 'aplic-3',
    versionNumber: 1,
    shuffleQuestions: true,
    shuffleAlternatives: true,
    withStudentIdentification: false,
    layout: {
      questionOrder: ['q-4', 'q-1', 'q-3', 'q-5', 'q-6'],
      alternativeOrder: [
        { questionId: 'q-1', printedOrder: ['q-1-b', 'q-1-d', 'q-1-c', 'q-1-a'] },
        { questionId: 'q-3', printedOrder: ['q-3-c', 'q-3-a', 'q-3-d', 'q-3-b'] },
        { questionId: 'q-4', printedOrder: ['q-4-d', 'q-4-c', 'q-4-a', 'q-4-b'] },
      ],
    },
    answerKeyPublished: false,
    publicCode: 'GAB-7G8H9I',
    qrCodePayload: 'mock-qr-versao-3',
    createdAt: '2026-04-16T12:00:00.000Z',
  },
  {
    /** Gabarito nao publicado: `answerKeyPublished` falso e sem `answerKeyPublishedAt`. */
    id: 'versao-4',
    applicationId: 'aplic-4',
    versionNumber: 1,
    shuffleQuestions: false,
    shuffleAlternatives: false,
    withStudentIdentification: true,
    layout: {
      questionOrder: ['q-1', 'q-3', 'q-4', 'q-5', 'q-6'],
      alternativeOrder: [],
    },
    answerKeyPublished: false,
    publicCode: 'GAB-2J3K4L',
    qrCodePayload: 'mock-qr-versao-4',
    createdAt: '2026-05-12T12:30:00.000Z',
  },
];

export const atribuicoesMock: AtribuicaoVersao[] = [
  // aplic-0 saiu em versao unica: uma atribuicao por estudante matriculado (RF06).
  ...estudantesMock.map((estudante, indice) => ({
    id: `atr-0-${indice + 1}`,
    examVersionId: 'versao-0',
    studentId: estudante.id,
    qrCodePayload: `mock-qr-versao-0-${estudante.id}`,
  })),
  { id: 'atr-1', examVersionId: 'versao-1', studentId: 'est-1', qrCodePayload: 'mock-qr-est-1' },
  { id: 'atr-2', examVersionId: 'versao-2', studentId: 'est-2', qrCodePayload: 'mock-qr-est-2' },
  { id: 'atr-3', examVersionId: 'versao-1', studentId: 'est-3', qrCodePayload: 'mock-qr-est-3' },
  { id: 'atr-4', examVersionId: 'versao-2', studentId: 'est-4', qrCodePayload: 'mock-qr-est-4' },
  { id: 'atr-5', examVersionId: 'versao-1', studentId: 'est-5', qrCodePayload: 'mock-qr-est-5' },
  { id: 'atr-6', examVersionId: 'versao-2', studentId: 'est-6', qrCodePayload: 'mock-qr-est-6' },
  // aplic-4 saiu em versao unica: uma atribuicao por estudante matriculado (RF06).
  ...estudantesMock.map((estudante, indice) => ({
    id: `atr-4-${indice + 1}`,
    examVersionId: 'versao-4',
    studentId: estudante.id,
    qrCodePayload: `mock-qr-versao-4-${estudante.id}`,
  })),
];
