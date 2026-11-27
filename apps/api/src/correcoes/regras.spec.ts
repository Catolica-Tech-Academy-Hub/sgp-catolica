/**
 * Gabarito e nota (RF08) contra os dados de demonstracao: o que a API monta a partir do
 * seed precisa bater com o que o aplicativo ja guarda nos mocks da fila.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  correcoesMock,
  filaCorrecoesMock,
  provasMock,
  questoesMock,
  versoesMock,
  aplicacoesMock,
} from '@sgp/mocks';
import type { GabaritoVersaoSnapshot, ItemFilaCorrecao } from '@sgp/shared-types';
import { gabaritosEquivalentes, montarGabarito, type QuestaoParaGabarito } from './gabarito';
import { calcularNota, lerItem } from './regras';

function questoesDaVersao(examVersionId: string): QuestaoParaGabarito[] {
  const versao = versoesMock.find((v) => v.id === examVersionId)!;
  const aplicacao = aplicacoesMock.find((a) => a.id === versao.applicationId)!;
  const prova = provasMock.find((p) => p.id === aplicacao.examId)!;
  return prova.questions.map(({ questionId, score }) => {
    const questao = questoesMock.find((q) => q.id === questionId)!;
    return {
      id: questao.id,
      type: questao.type,
      correctAlternativeId: questao.correctAlternativeId ?? null,
      alternativeIds: (questao.alternatives ?? []).map((a) => a.id),
      score,
    };
  });
}

function gabaritoDoSeed(examVersionId: string): GabaritoVersaoSnapshot {
  const versao = versoesMock.find((v) => v.id === examVersionId)!;
  return montarGabarito(versao.id, versao.layout, questoesDaVersao(versao.id), 'agora');
}

function copia<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

const itemSincronizado = filaCorrecoesMock.find((i) => i.clientCorrectionId === 'c1f3a8de-0001')!;

describe('gabarito montado pela API', () => {
  it('bate com o snapshot que o aplicativo guarda para cada versao dos mocks da fila', () => {
    for (const item of filaCorrecoesMock) {
      assert.ok(
        gabaritosEquivalentes(gabaritoDoSeed(item.examVersionId), item.answerKeySnapshot),
        `gabarito de ${item.examVersionId}`,
      );
    }
  });

  it('usa a ordem de cadastro quando a versao nao embaralhou alternativas', () => {
    const q1 = gabaritoDoSeed('versao-2').objectiveQuestions.find((q) => q.questionId === 'q-1');
    assert.deepEqual(q1?.printedOrder, ['q-1-a', 'q-1-b', 'q-1-c', 'q-1-d']);
  });

  it('detecta mudanca de alternativa correta, pontuacao ou letras impressas', () => {
    const base = itemSincronizado.answerKeySnapshot;
    const outraCorreta = copia(base);
    outraCorreta.objectiveQuestions[0].correctAlternativeId = 'q-1-a';
    const outraPontuacao = copia(base);
    outraPontuacao.discursiveQuestions[0].maxScore = 9;
    const outraOrdem = copia(base);
    outraOrdem.objectiveQuestions[0].printedOrder.reverse();
    for (const mudado of [outraCorreta, outraPontuacao, outraOrdem]) {
      assert.equal(gabaritosEquivalentes(base, mudado), false);
    }
    assert.ok(gabaritosEquivalentes(base, { ...copia(base), capturedAt: 'outra data' }));
  });
});

describe('nota calculada pelo snapshot', () => {
  it('reproduz a nota da correcao ja registrada no seed', () => {
    const nota = calcularNota(itemSincronizado);
    assert.ok(nota.ok);
    const registrada = correcoesMock.find((c) => c.clientCorrectionId === 'c1f3a8de-0001')!;
    assert.equal(nota.valor.totalScore, registrada.totalScore);
    assert.deepEqual(nota.valor.objectiveResults, registrada.objectiveResults);
  });

  it('usa o gabarito do snapshot, nao o atual', () => {
    const item = copia(itemSincronizado);
    // q-4 marcada como q-4-c; um snapshot em que q-4-c e a correta da os 2 pontos.
    const q4 = item.answerKeySnapshot.objectiveQuestions.find((q) => q.questionId === 'q-4')!;
    q4.correctAlternativeId = 'q-4-c';
    const nota = calcularNota(item);
    assert.ok(nota.ok);
    assert.equal(nota.valor.totalScore, 9.5);
  });

  it('conta objetiva em branco como errada', () => {
    const item = copia(itemSincronizado);
    item.objectiveAnswers = [];
    const nota = calcularNota(item);
    assert.ok(nota.ok);
    assert.ok(nota.valor.objectiveResults.every((r) => !r.correct && r.score === 0));
  });

  it('recusa discursiva sem nota, acima do maximo ou alternativa fora da versao', () => {
    const semNota = copia(itemSincronizado);
    semNota.discursiveScores = semNota.discursiveScores.slice(1);
    const acima = copia(itemSincronizado);
    acima.discursiveScores[0].score = 99;
    const foraDaVersao = copia(itemSincronizado);
    foraDaVersao.objectiveAnswers[0].selectedAlternativeId = 'q-2-a';
    for (const item of [semNota, acima, foraDaVersao]) assert.equal(calcularNota(item).ok, false);
  });
});

describe('leitura do item do lote', () => {
  it('aceita os itens dos mocks da fila', () => {
    for (const item of filaCorrecoesMock)
      assert.ok(lerItem(copia(item)).ok, item.clientCorrectionId);
  });

  it('recusa item sem snapshot, com snapshot de outra versao ou sem identificador', () => {
    const semSnapshot: Partial<ItemFilaCorrecao> = copia(itemSincronizado);
    delete semSnapshot.answerKeySnapshot;
    const outraVersao = copia(itemSincronizado);
    outraVersao.answerKeySnapshot.examVersionId = 'versao-2';
    const semId = { ...copia(itemSincronizado), clientCorrectionId: '' };
    for (const item of [semSnapshot, outraVersao, semId, null, 'texto']) {
      assert.equal(lerItem(item).ok, false);
    }
  });
});
