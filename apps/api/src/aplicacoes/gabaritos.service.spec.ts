/** Gabaritos para o aplicativo (RF08) e isolamento por professor (RNF04). */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  aplicacoesMock,
  filaCorrecoesMock,
  provasMock,
  questoesMock,
  versoesMock,
} from '@sgp/mocks';
import { gabaritosEquivalentes } from '../correcoes/gabarito';
import type { PrismaService } from '../prisma/prisma.service';
import { AplicacoesService } from './aplicacoes.service';

/** Responde a consulta de `gabaritos`: aplicacao do professor com prova e versoes. */
function criarServico(removerQuestao?: string) {
  const banco = {
    aplicacao: {
      findFirst: async ({ where }: { where: { id: string; teacherId: string } }) => {
        const aplicacao = aplicacoesMock.find(
          (a) => a.id === where.id && a.teacherId === where.teacherId,
        );
        if (!aplicacao) return null;
        const prova = provasMock.find((p) => p.id === aplicacao.examId)!;
        return {
          ...aplicacao,
          prova: {
            ...prova,
            questoes: prova.questions
              .filter((q) => q.questionId !== removerQuestao)
              .map(({ questionId, score }) => {
                const questao = questoesMock.find((q) => q.id === questionId)!;
                return {
                  score,
                  questao: {
                    ...questao,
                    correctAlternativeId: questao.correctAlternativeId ?? null,
                    alternativas: (questao.alternatives ?? []).map((a, position) => ({
                      ...a,
                      position,
                    })),
                  },
                };
              }),
          },
          versoes: versoesMock.filter((v) => v.applicationId === aplicacao.id),
        };
      },
    },
  };
  return new AplicacoesService(banco as unknown as PrismaService);
}

describe('gabaritos da aplicacao', () => {
  it('devolve um gabarito por versao, igual ao que o aplicativo guarda', async () => {
    const gabaritos = await criarServico().gabaritos('prof-1', 'aplic-1');
    assert.deepEqual(
      gabaritos.map((g) => g.examVersionId),
      ['versao-1', 'versao-2'],
    );
    for (const gabarito of gabaritos) {
      const doAplicativo = filaCorrecoesMock.find(
        (i) => i.examVersionId === gabarito.examVersionId,
      )!.answerKeySnapshot;
      assert.ok(gabaritosEquivalentes(gabarito, doAplicativo));
      assert.ok(!Number.isNaN(Date.parse(gabarito.capturedAt)));
    }
  });

  it('responde 404 para aplicacao de outro professor', async () => {
    await assert.rejects(criarServico().gabaritos('prof-2', 'aplic-1'), NotFoundException);
  });

  it('responde 409 quando a prova perdeu uma questao impressa na versao', async () => {
    await assert.rejects(criarServico('q-5').gabaritos('prof-1', 'aplic-1'), ConflictException);
  });
});
