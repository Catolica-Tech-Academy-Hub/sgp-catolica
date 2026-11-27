/**
 * Acesso cruzado entre professores (RNF04, issue #83).
 *
 * Os servicos rodam contra um banco em memoria que entende o subconjunto de filtros do
 * Prisma usado por eles (igualdade, `in`, relacao 1:1 e `some`). Assim o teste confere o
 * filtro por dono que cada servico monta, sem depender de um MySQL rodando.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EstudantesService } from '../estudantes/estudantes.service';
import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { ProvasService } from '../provas/provas.service';
import { QuestoesService } from '../questoes/questoes.service';
import { TurmasService } from '../turmas/turmas.service';
import { idDoProfessor } from './professor';

type Linha = Record<string, unknown>;
type Filtro = Record<string, unknown>;
type Tabela =
  'usuario' | 'turma' | 'matricula' | 'questao' | 'alternativa' | 'prova' | 'questaoDaProva';

const PROF_1 = 'prof-1';
const PROF_2 = 'prof-2';
const DATA = new Date('2026-03-01T12:00:00.000Z');

function criarBanco() {
  const tabelas: Record<Tabela, Linha[]> = {
    usuario: [
      {
        id: PROF_1,
        role: 'professor',
        fullName: 'Prof Um',
        email: 'um@docente.example.org',
        createdAt: DATA,
      },
      {
        id: PROF_2,
        role: 'professor',
        fullName: 'Prof Dois',
        email: 'dois@docente.example.org',
        createdAt: DATA,
      },
      {
        id: 'est-a',
        role: 'estudante',
        fullName: 'Estudante A',
        email: 'a@aluno.example.com',
        registration: null,
        createdAt: DATA,
        anonymizedAt: null,
      },
      {
        id: 'est-b',
        role: 'estudante',
        fullName: 'Estudante B',
        email: 'b@aluno.example.com',
        registration: null,
        createdAt: DATA,
        anonymizedAt: null,
      },
    ],
    turma: [
      {
        id: 'turma-p1',
        teacherId: PROF_1,
        name: 'T1',
        subject: 'S',
        term: '2026/1',
        status: 'active',
        inviteCode: 'AAA-2026-0001',
        createdAt: DATA,
      },
      {
        id: 'turma-p2',
        teacherId: PROF_2,
        name: 'T2',
        subject: 'S',
        term: '2026/1',
        status: 'active',
        inviteCode: 'BBB-2026-0002',
        createdAt: DATA,
      },
    ],
    matricula: [
      {
        id: 'mat-p1',
        classId: 'turma-p1',
        studentId: 'est-a',
        enrolledAt: DATA,
        status: 'active',
        enrolledVia: 'teacher',
      },
      {
        id: 'mat-p2',
        classId: 'turma-p2',
        studentId: 'est-b',
        enrolledAt: DATA,
        status: 'active',
        enrolledVia: 'teacher',
      },
    ],
    questao: [
      {
        id: 'q-p1',
        teacherId: PROF_1,
        type: 'discursiva',
        statement: 'Q1',
        tags: [],
        correctAlternativeId: null,
        maxScore: 2,
        createdAt: DATA,
        deletedAt: null,
      },
      {
        id: 'q-p2',
        teacherId: PROF_2,
        type: 'discursiva',
        statement: 'Q2',
        tags: [],
        correctAlternativeId: null,
        maxScore: 2,
        createdAt: DATA,
        deletedAt: null,
      },
    ],
    alternativa: [],
    prova: [
      {
        id: 'prova-p1',
        teacherId: PROF_1,
        title: 'P1',
        description: null,
        status: 'draft',
        blocos: null,
        createdAt: DATA,
      },
      {
        id: 'prova-p2',
        teacherId: PROF_2,
        title: 'P2',
        description: null,
        status: 'draft',
        blocos: null,
        createdAt: DATA,
      },
    ],
    questaoDaProva: [],
  };

  /** Relacoes que os filtros dos servicos atravessam. */
  const relacoes: Partial<
    Record<Tabela, Record<string, (linha: Linha) => Linha | Linha[] | undefined>>
  > = {
    matricula: { turma: (m) => tabelas.turma.find((t) => t.id === m.classId) },
    usuario: { matriculas: (u) => tabelas.matricula.filter((m) => m.studentId === u.id) },
  };

  function confere(tabela: Tabela, linha: Linha, filtro: Filtro = {}): boolean {
    return Object.entries(filtro).every(([campo, esperado]) => {
      const relacao = relacoes[tabela]?.[campo];
      if (relacao) {
        const relacionado = relacao(linha);
        const alvo: Tabela = campo === 'turma' ? 'turma' : 'matricula';
        if (Array.isArray(relacionado)) {
          const { some } = esperado as { some: Filtro };
          return relacionado.some((item) => confere(alvo, item, some));
        }
        return relacionado !== undefined && confere(alvo, relacionado, esperado as Filtro);
      }
      if (esperado !== null && typeof esperado === 'object' && 'in' in esperado) {
        return (esperado as { in: unknown[] }).in.includes(linha[campo]);
      }
      return linha[campo] === esperado;
    });
  }

  /** Anexa as relacoes que os mapeadores leem (`include`). */
  function completar(tabela: Tabela, linha: Linha): Linha {
    if (tabela === 'questao') {
      return {
        ...linha,
        alternativas: tabelas.alternativa.filter((a) => a.questionId === linha.id),
      };
    }
    if (tabela === 'prova') {
      return { ...linha, questoes: tabelas.questaoDaProva.filter((q) => q.examId === linha.id) };
    }
    return { ...linha };
  }

  function modelo(tabela: Tabela) {
    const linhas = () => tabelas[tabela];
    const porId = (id: unknown) => linhas().find((linha) => linha.id === id);
    const gravar = (dados: Linha) => {
      const { alternativas, questoes, ...campos } = dados as Linha & {
        alternativas?: { create: Linha[] };
        questoes?: { create: Linha[] };
      };
      let linha = porId(campos.id);
      if (!linha) {
        linha = { createdAt: DATA, deletedAt: null, ...campos };
        linhas().push(linha);
      } else {
        Object.assign(linha, campos);
      }
      for (const alternativa of alternativas?.create ?? []) {
        tabelas.alternativa.push({ ...alternativa, questionId: linha.id });
      }
      for (const questao of questoes?.create ?? []) {
        tabelas.questaoDaProva.push({ ...questao, examId: linha.id });
      }
      return completar(tabela, linha);
    };

    return {
      findMany: async ({ where }: { where?: Filtro } = {}) =>
        linhas()
          .filter((linha) => confere(tabela, linha, where))
          .map((linha) => completar(tabela, linha)),
      findFirst: async ({ where }: { where?: Filtro }) => {
        const linha = linhas().find((item) => confere(tabela, item, where));
        return linha ? completar(tabela, linha) : null;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const linha = porId(where.id);
        return linha ? completar(tabela, linha) : null;
      },
      create: async ({ data }: { data: Linha }) => {
        if (data.id !== undefined && porId(data.id)) {
          throw new Prisma.PrismaClientKnownRequestError('Id ja existe.', {
            code: 'P2002',
            clientVersion: 'teste',
          });
        }
        return gravar({ id: `${tabela}-${linhas().length + 1}`, ...data });
      },
      update: async ({ where, data }: { where: { id: string }; data: Linha }) =>
        gravar({ ...data, id: where.id }),
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { id: string };
        create: Linha;
        update: Linha;
      }) => gravar(porId(where.id) ? { ...update, id: where.id } : create),
      deleteMany: async ({ where }: { where?: Filtro } = {}) => {
        const antes = linhas().length;
        tabelas[tabela] = linhas().filter((linha) => !confere(tabela, linha, where));
        return { count: antes - tabelas[tabela].length };
      },
    };
  }

  const banco = {
    usuario: modelo('usuario'),
    turma: modelo('turma'),
    matricula: modelo('matricula'),
    questao: modelo('questao'),
    alternativa: modelo('alternativa'),
    prova: modelo('prova'),
    questaoDaProva: modelo('questaoDaProva'),
    $transaction: async <T>(executar: (tx: object) => Promise<T>) => executar(banco),
  };

  return { banco: banco as unknown as PrismaService, tabelas };
}

let tabelas: ReturnType<typeof criarBanco>['tabelas'];
let turmas: TurmasService;
let estudantes: EstudantesService;
let questoes: QuestoesService;
let provas: ProvasService;

beforeEach(() => {
  const criado = criarBanco();
  tabelas = criado.tabelas;
  turmas = new TurmasService(criado.banco);
  estudantes = new EstudantesService(criado.banco);
  questoes = new QuestoesService(criado.banco);
  provas = new ProvasService(criado.banco);
});

describe('identificacao do professor', () => {
  it('devolve o id do professor da requisicao', () => {
    assert.equal(idDoProfessor({ usuario: { id: PROF_2, role: 'professor' } }), PROF_2);
  });

  it('recusa token de estudante com 403', () => {
    assert.throws(
      () => idDoProfessor({ usuario: { id: 'est-a', role: 'estudante' } }),
      ForbiddenException,
    );
  });

  it('recusa requisicao sem usuario com 401', () => {
    assert.throws(() => idDoProfessor({}), UnauthorizedException);
  });
});

describe('turmas e matriculas', () => {
  it('lista so as turmas e matriculas do proprio professor', async () => {
    assert.deepEqual(
      (await turmas.listar(PROF_1)).map((t) => t.id),
      ['turma-p1'],
    );
    assert.deepEqual(
      (await turmas.listar(PROF_2)).map((t) => t.id),
      ['turma-p2'],
    );
    assert.deepEqual(
      (await turmas.listarMatriculas(PROF_1)).map((m) => m.id),
      ['mat-p1'],
    );
  });

  it('responde 404 ao alterar, arquivar ou regenerar convite da turma de outro professor', async () => {
    const dados = { name: 'Invadida', subject: 'X', term: '2026/2' };
    await assert.rejects(turmas.atualizar(PROF_1, 'turma-p2', dados), NotFoundException);
    await assert.rejects(turmas.arquivar(PROF_1, 'turma-p2'), NotFoundException);
    await assert.rejects(turmas.regenerarCodigoDeConvite(PROF_1, 'turma-p2'), NotFoundException);
    const intacta = tabelas.turma.find((t) => t.id === 'turma-p2');
    assert.equal(intacta?.name, 'T2');
    assert.equal(intacta?.status, 'active');
    assert.equal(intacta?.inviteCode, 'BBB-2026-0002');
  });

  it('nao revela turma de outro professor ao criar com o mesmo id', async () => {
    const dados = { name: 'N', subject: 'S', term: '2026/1' };
    await assert.rejects(turmas.criar(PROF_1, { ...dados, id: 'turma-p2' }), NotFoundException);
    await assert.rejects(turmas.criar(PROF_1, { ...dados, id: 'turma-p1' }), ConflictException);
  });

  it('cria a turma no nome de quem pediu', async () => {
    const turma = await turmas.criar(PROF_2, {
      id: 'turma-nova',
      name: 'N',
      subject: 'S',
      term: '2026/1',
    });
    assert.equal(turma.teacherId, PROF_2);
  });

  it('responde 404 ao remover ou restaurar matricula da turma de outro professor', async () => {
    await assert.rejects(
      turmas.alterarSituacaoDaMatricula(PROF_1, 'mat-p2', 'removed'),
      NotFoundException,
    );
    await assert.rejects(
      turmas.alterarSituacaoDaMatricula(PROF_1, 'mat-p2', 'active'),
      NotFoundException,
    );
    assert.equal(tabelas.matricula.find((m) => m.id === 'mat-p2')?.status, 'active');
  });
});

describe('estudantes', () => {
  it('lista so estudantes matriculados nas turmas do professor', async () => {
    assert.deepEqual(
      (await estudantes.listar(PROF_1)).map((e) => e.id),
      ['est-a'],
    );
    assert.deepEqual(
      (await estudantes.listar(PROF_2)).map((e) => e.id),
      ['est-b'],
    );
  });
});

describe('questoes', () => {
  const discursiva = { type: 'discursiva' as const, statement: 'Nova', tags: [], maxScore: 1 };

  it('lista e obtem so as questoes do proprio professor', async () => {
    assert.deepEqual(
      (await questoes.listar(PROF_1, true)).map((q) => q.id),
      ['q-p1'],
    );
    await assert.rejects(questoes.obter(PROF_1, 'q-p2'), NotFoundException);
  });

  it('responde 404 ao sobrescrever, excluir ou restaurar questao de outro professor', async () => {
    await assert.rejects(questoes.salvar(PROF_1, 'q-p2', discursiva), NotFoundException);
    await assert.rejects(questoes.alterarExclusao(PROF_1, 'q-p2', true), NotFoundException);
    await assert.rejects(questoes.alterarExclusao(PROF_1, 'q-p2', false), NotFoundException);
    const intacta = tabelas.questao.find((q) => q.id === 'q-p2');
    assert.equal(intacta?.statement, 'Q2');
    assert.equal(intacta?.deletedAt, null);
  });

  it('cria a questao no nome de quem pediu', async () => {
    const questao = await questoes.salvar(PROF_2, 'q-nova', discursiva);
    assert.equal(questao.teacherId, PROF_2);
  });
});

describe('provas', () => {
  const prova = { title: 'Invadida', status: 'draft' as const, questions: [] };

  it('lista so as provas do proprio professor', async () => {
    assert.deepEqual(
      (await provas.listar(PROF_1)).map((p) => p.id),
      ['prova-p1'],
    );
  });

  it('responde 404 ao sobrescrever prova de outro professor', async () => {
    await assert.rejects(provas.salvar(PROF_1, 'prova-p2', prova), NotFoundException);
    assert.equal(tabelas.prova.find((p) => p.id === 'prova-p2')?.title, 'P2');
  });

  it('nao vincula a prova uma questao de outro professor', async () => {
    const salva = await provas.salvar(PROF_1, 'prova-p1', {
      ...prova,
      questions: [
        { questionId: 'q-p1', order: 1, score: 1 },
        { questionId: 'q-p2', order: 2, score: 1 },
      ],
    });
    assert.deepEqual(
      salva.questions.map((q) => q.questionId),
      ['q-p1'],
    );
  });
});
