/**
 * Popula o banco com os dados de demonstracao de `@sgp/mocks`.
 *
 * Os mocks deixam de ser lidos pelas telas quando a API esta ligada, mas continuam
 * sendo a semente: assim o banco nasce com o mesmo acervo que o cliente ja viu, e os
 * ids batem com o que ainda vive no navegador (provas e seus blocos, issue #12).
 *
 * Roda com `npm run db:seed --workspace @sgp/api`. Apaga tudo antes de inserir, entao
 * repetir o seed volta o banco ao estado de demonstracao.
 */
import 'dotenv/config';
import {
  aplicacoesMock,
  atribuicoesMock,
  correcoesMock,
  estudantesMock,
  matriculasMock,
  professorMock,
  provasMock,
  questoesMock,
  turmasMock,
  versoesMock,
} from '@sgp/mocks';
import { PrismaClient } from '../src/generated/prisma/client';
import { criarAdaptadorMysql } from '../src/prisma/adaptador';

const prisma = new PrismaClient({ adapter: criarAdaptadorMysql() });

/**
 * O padrao do Prisma (5 s) nao basta contra um banco hospedado: cada insert faz uma ida e
 * volta pela rede, e a transacao expirava no meio, desfazendo o que ja tinha gravado.
 */
const TEMPO_DA_TRANSACAO = { maxWait: 20_000, timeout: 180_000 };

async function semear(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Ordem inversa das chaves estrangeiras.
    await tx.correcao.deleteMany();
    await tx.atribuicaoVersao.deleteMany();
    await tx.versaoProva.deleteMany();
    await tx.aplicacao.deleteMany();
    await tx.questaoDaProva.deleteMany();
    await tx.prova.deleteMany();
    await tx.alternativa.deleteMany();
    await tx.questao.deleteMany();
    await tx.matricula.deleteMany();
    await tx.turma.deleteMany();
    await tx.usuario.deleteMany();

    await tx.usuario.createMany({
      data: [
        { ...professorMock, createdAt: new Date(professorMock.createdAt) },
        ...estudantesMock.map((estudante) => ({
          ...estudante,
          createdAt: new Date(estudante.createdAt),
        })),
      ],
    });

    await tx.turma.createMany({
      data: turmasMock.map((turma) => ({ ...turma, createdAt: new Date(turma.createdAt) })),
    });

    await tx.matricula.createMany({
      data: matriculasMock.map((matricula) => ({
        ...matricula,
        enrolledAt: new Date(matricula.enrolledAt),
      })),
    });

    for (const { alternatives, deletedAt, ...questao } of questoesMock) {
      await tx.questao.create({
        data: {
          ...questao,
          // Os mocks nao tem data de criacao; a mesma data para todas mantem a ordem por id.
          createdAt: new Date(professorMock.createdAt),
          deletedAt: deletedAt ? new Date(deletedAt) : null,
          alternativas: {
            create: (alternatives ?? []).map((alternativa, position) => ({
              ...alternativa,
              position,
            })),
          },
        },
      });
    }

    for (const { questions, createdAt, ...prova } of provasMock) {
      await tx.prova.create({
        data: {
          ...prova,
          createdAt: new Date(createdAt),
          questoes: { create: questions },
        },
      });
    }

    await tx.aplicacao.createMany({
      data: aplicacoesMock.map((aplicacao) => ({
        ...aplicacao,
        createdAt: new Date(aplicacao.createdAt),
      })),
    });

    await tx.versaoProva.createMany({
      data: versoesMock.map((versao) => ({
        ...versao,
        layout: { ...versao.layout },
        answerKeyPublishedAt: versao.answerKeyPublishedAt
          ? new Date(versao.answerKeyPublishedAt)
          : null,
        createdAt: new Date(versao.createdAt),
      })),
    });

    await tx.atribuicaoVersao.createMany({ data: atribuicoesMock });

    await tx.correcao.createMany({
      data: correcoesMock.map((correcao) => ({
        ...correcao,
        // Copias planas: o tipo de entrada JSON do Prisma nao aceita interfaces nomeadas.
        objectiveResults: correcao.objectiveResults.map((resultado) => ({ ...resultado })),
        discursiveScores: correcao.discursiveScores.map((nota) => ({ ...nota })),
        confirmedAt: new Date(correcao.confirmedAt),
      })),
    });
  }, TEMPO_DA_TRANSACAO);
}

semear()
  .then(() => console.log('Banco populado com os dados de @sgp/mocks.'))
  .catch((erro: unknown) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
