import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import mocks from '@sgp/mocks';
import {
  contarCorrecoesIlegiveis,
  enfileirarCorrecao,
  iniciarFilaPersistente,
  listarFila,
  obterGabaritoDaVersao,
} from './estado-de-correcoes.ts';
import { criarFilaPersistente, mesclarComMocks } from './fila-persistente.ts';

const { filaCorrecoesMock } = mocks;
const PREFIXO = '@sgp/fila-correcoes/v1/';

/** Armazenamento em memoria, com falhas ligadas por teste. */
function criarArmazenamento() {
  const dados = new Map();
  return {
    dados,
    falharAoGravar: false,
    falharAoLer: false,
    gravacoes: 0,
    async getAllKeys() {
      if (this.falharAoLer) throw new Error('falha de leitura');
      return [...dados.keys()];
    },
    async multiGet(chaves) {
      if (this.falharAoLer) throw new Error('falha de leitura');
      return chaves.map((chave) => [chave, dados.get(chave) ?? null]);
    },
    async setItem(chave, valor) {
      if (this.falharAoGravar) throw new Error('falha de gravacao');
      this.gravacoes += 1;
      dados.set(chave, valor);
    },
  };
}

// Dados neutros: nenhum aluno ou prova real.
const item = (id, sobrescrita = {}) => ({
  clientCorrectionId: id,
  examVersionId: 'versao-teste',
  objectiveAnswers: [{ questionId: 'q1', selectedAlternativeId: 'q1-a' }],
  discursiveScores: [{ questionId: 'q2', score: 1.5 }],
  answerKeySnapshot: {
    examVersionId: 'versao-teste',
    capturedAt: '2026-01-01T00:00:00.000Z',
    objectiveQuestions: [
      { questionId: 'q1', correctAlternativeId: 'q1-a', printedOrder: ['q1-a'], score: 2 },
    ],
    discursiveQuestions: [{ questionId: 'q2', maxScore: 3 }],
  },
  capturedAt: '2026-01-02T00:00:00.000Z',
  syncStatus: 'pending',
  ...sobrescrita,
});

describe('camada de persistencia da fila', () => {
  it('salva e carrega o item completo, com o answerKeySnapshot', async () => {
    const fila = criarFilaPersistente(criarArmazenamento());
    await fila.salvar(item('a'));
    assert.deepEqual(await fila.carregar(), { itens: [item('a')], chavesIlegiveis: [] });
  });

  for (const syncStatus of ['pending', 'synced', 'error']) {
    it(`mantem o status ${syncStatus}`, async () => {
      const fila = criarFilaPersistente(criarArmazenamento());
      const original = item('a', {
        syncStatus,
        syncError: syncStatus === 'error' ? 'motivo' : undefined,
      });
      await fila.salvar(original);
      const { itens } = await fila.carregar();
      assert.equal(itens[0].syncStatus, syncStatus);
      assert.equal(itens[0].syncError, original.syncError);
    });
  }

  it('grava cada item em uma chave propria', async () => {
    const armazenamento = criarArmazenamento();
    const fila = criarFilaPersistente(armazenamento);
    await fila.salvar(item('a'));
    await fila.salvar(item('b'));
    assert.deepEqual([...armazenamento.dados.keys()], [`${PREFIXO}a`, `${PREFIXO}b`]);
  });

  it('regravar o mesmo identificador nao duplica', async () => {
    const fila = criarFilaPersistente(criarArmazenamento());
    await fila.salvar(item('a'));
    await fila.salvar(item('a', { syncStatus: 'error' }));
    const { itens } = await fila.carregar();
    assert.equal(itens.length, 1);
    assert.equal(itens[0].syncStatus, 'error');
  });

  it('ignora chaves de outros modulos', async () => {
    const armazenamento = criarArmazenamento();
    armazenamento.dados.set('outra-chave', '{}');
    assert.deepEqual(await criarFilaPersistente(armazenamento).carregar(), {
      itens: [],
      chavesIlegiveis: [],
    });
  });

  for (const [nome, conteudo] of [
    ['JSON quebrado', '{quebrado'],
    ['valor nao objeto', '123'],
    ['sem snapshot', JSON.stringify({ ...item('a'), answerKeySnapshot: undefined })],
    [
      'snapshot de outra versao',
      JSON.stringify(
        item('a', { answerKeySnapshot: { ...item('a').answerKeySnapshot, examVersionId: 'x' } }),
      ),
    ],
    ['status desconhecido', JSON.stringify(item('a', { syncStatus: 'enviado' }))],
    ['identificador diferente da chave', JSON.stringify(item('b'))],
  ]) {
    it(`item com ${nome} e relatado, mantido e nao bloqueia os demais`, async () => {
      const armazenamento = criarArmazenamento();
      const fila = criarFilaPersistente(armazenamento);
      await fila.salvar(item('valido'));
      armazenamento.dados.set(`${PREFIXO}a`, conteudo);

      const { itens, chavesIlegiveis } = await fila.carregar();
      assert.deepEqual(
        itens.map((i) => i.clientCorrectionId),
        ['valido'],
      );
      assert.deepEqual(chavesIlegiveis, [`${PREFIXO}a`]);
      assert.equal(armazenamento.dados.get(`${PREFIXO}a`), conteudo);
    });
  }

  it('propaga falha de leitura do armazenamento', async () => {
    const armazenamento = criarArmazenamento();
    armazenamento.falharAoLer = true;
    await assert.rejects(criarFilaPersistente(armazenamento).carregar());
  });

  it('mescla mocks e salvos uma vez por identificador, com o salvo prevalecendo', () => {
    const demonstracao = [item('m1'), item('m2')];
    const salvos = [item('m2', { syncStatus: 'error' }), item('novo')];
    const resultado = mesclarComMocks(demonstracao, salvos);
    assert.deepEqual(
      resultado.map((i) => i.clientCorrectionId),
      ['m1', 'm2', 'novo'],
    );
    assert.equal(resultado[1].syncStatus, 'error');
    assert.equal(demonstracao[1].syncStatus, 'pending');
  });
});

// Precisa rodar antes de qualquer `iniciarFilaPersistente`, porque o estado e unico no modulo.
describe('fila do aplicativo antes da carga', () => {
  it('sem armazenamento iniciado, nao confirma a correcao', async () => {
    const antes = listarFila().length;
    const resultado = await enfileirarCorrecao({
      examVersionId: 'versao-1',
      studentId: 'aluno-ficticio',
      objectiveAnswers: [{ questionId: 'q-1', selectedAlternativeId: 'q-1-c' }],
      discursiveScores: [],
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.motivo, 'falha_ao_salvar');
    assert.equal(listarFila().length, antes);
  });
});

describe('fila do aplicativo com persistencia', () => {
  const VERSAO = 'versao-1';
  const correcao = (sobrescrita = {}) => ({
    examVersionId: VERSAO,
    studentId: 'aluno-ficticio',
    objectiveAnswers: [{ questionId: 'q-1', selectedAlternativeId: 'q-1-c' }],
    discursiveScores: [],
    ...sobrescrita,
  });
  const contar = (id) => listarFila().filter((i) => i.clientCorrectionId === id).length;
  let armazenamento;

  beforeEach(async () => {
    armazenamento = criarArmazenamento();
    await iniciarFilaPersistente(armazenamento);
  });

  it('a fila sobrevive a reabertura, com o snapshot e o status', async () => {
    const { item: salvo } = await enfileirarCorrecao(correcao());

    await iniciarFilaPersistente(armazenamento);

    const reaberto = listarFila().find((i) => i.clientCorrectionId === salvo.clientCorrectionId);
    assert.deepEqual(JSON.parse(JSON.stringify(reaberto)), JSON.parse(JSON.stringify(salvo)));
    assert.deepEqual(reaberto.answerKeySnapshot, obterGabaritoDaVersao(VERSAO));
    assert.equal(reaberto.syncStatus, 'pending');
  });

  it('salva antes de colocar a correcao na fila', async () => {
    const original = armazenamento.setItem;
    let idsNaFilaDuranteGravacao;
    armazenamento.setItem = async function (chave, valor) {
      idsNaFilaDuranteGravacao = listarFila().map((i) => i.clientCorrectionId);
      return original.call(this, chave, valor);
    };
    await iniciarFilaPersistente(armazenamento);

    const { item: salvo } = await enfileirarCorrecao(correcao());
    assert.equal(idsNaFilaDuranteGravacao.includes(salvo.clientCorrectionId), false);
    assert.equal(contar(salvo.clientCorrectionId), 1);
  });

  it('falha ao gravar nao confirma nem coloca na fila', async () => {
    const antes = listarFila().length;
    armazenamento.falharAoGravar = true;
    const resultado = await enfileirarCorrecao(correcao());

    assert.equal(resultado.ok, false);
    assert.equal(resultado.motivo, 'falha_ao_salvar');
    assert.equal(listarFila().length, antes);
    assert.equal(armazenamento.dados.size, 0);
  });

  it('repetir apos falha usa o mesmo identificador e gera um unico item', async () => {
    armazenamento.falharAoGravar = true;
    const falha = await enfileirarCorrecao(correcao());
    armazenamento.falharAoGravar = false;

    const novo = await enfileirarCorrecao(
      correcao({ clientCorrectionId: falha.clientCorrectionId }),
    );
    assert.equal(novo.item.clientCorrectionId, falha.clientCorrectionId);
    assert.equal(contar(falha.clientCorrectionId), 1);
    assert.equal(armazenamento.dados.size, 1);
  });

  it('repetir um identificador ja salvo nao grava de novo', async () => {
    const { item: salvo } = await enfileirarCorrecao(correcao());
    const gravacoes = armazenamento.gravacoes;
    const repetido = await enfileirarCorrecao(
      correcao({ clientCorrectionId: salvo.clientCorrectionId }),
    );
    assert.equal(repetido.item, salvo);
    assert.equal(armazenamento.gravacoes, gravacoes);
    assert.equal(contar(salvo.clientCorrectionId), 1);
  });

  it('versao sem gabarito local nao grava nada', async () => {
    const resultado = await enfileirarCorrecao(correcao({ examVersionId: 'versao-0' }));
    assert.deepEqual(resultado, { ok: false, motivo: 'sem_gabarito' });
    assert.equal(armazenamento.dados.size, 0);
  });

  it('os mocks nao sao gravados nem duplicados em varias reaberturas', async () => {
    const { item: salvo } = await enfileirarCorrecao(correcao());
    for (let i = 0; i < 3; i += 1) await iniciarFilaPersistente(armazenamento);

    assert.equal(armazenamento.dados.size, 1);
    assert.equal(listarFila().length, filaCorrecoesMock.length + 1);
    for (const mock of filaCorrecoesMock) assert.equal(contar(mock.clientCorrectionId), 1);
    assert.equal(contar(salvo.clientCorrectionId), 1);
  });

  it('item salvo com identificador de mock aparece uma unica vez', async () => {
    const [mock] = filaCorrecoesMock;
    await criarFilaPersistente(armazenamento).salvar({ ...mock, syncStatus: 'error' });
    await iniciarFilaPersistente(armazenamento);

    assert.equal(contar(mock.clientCorrectionId), 1);
    assert.equal(
      listarFila().find((i) => i.clientCorrectionId === mock.clientCorrectionId).syncStatus,
      'error',
    );
  });

  it('falha ao carregar rejeita e preserva o que esta salvo', async () => {
    await enfileirarCorrecao(correcao());
    const quantidade = armazenamento.dados.size;
    armazenamento.falharAoLer = true;
    await assert.rejects(iniciarFilaPersistente(armazenamento));
    assert.equal(armazenamento.dados.size, quantidade);
  });

  it('informa as correcoes que nao puderam ser lidas', async () => {
    armazenamento.dados.set(`${PREFIXO}quebrado`, '{quebrado');
    await iniciarFilaPersistente(armazenamento);
    assert.equal(contarCorrecoesIlegiveis(), 1);
    assert.equal(armazenamento.dados.has(`${PREFIXO}quebrado`), true);
  });
});
