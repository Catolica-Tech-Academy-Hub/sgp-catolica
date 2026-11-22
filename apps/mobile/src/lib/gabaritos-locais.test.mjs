import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import mocks from '@sgp/mocks';
import {
  contarCorrecoesIlegiveis,
  enfileirarCorrecao,
  iniciarFilaPersistente,
  listarFila,
  obterGabaritoDaVersao,
  obterProvaParaCorrigir,
} from './estado-de-correcoes.ts';
import { criarFilaPersistente } from './fila-persistente.ts';
import {
  criarGabaritosLocais,
  gabaritoCompativelComLayout,
  gabaritoValido,
} from './gabaritos-locais.ts';

const PREFIXO = '@sgp/gabaritos/v1/';
const ANTES = '2026-01-01T10:00:00.000Z';
const DEPOIS = '2026-01-02T10:00:00.000Z';

/** Armazenamento em memoria, com falhas ligadas por teste. */
function criarArmazenamento() {
  const dados = new Map();
  return {
    dados,
    falharAoGravar: false,
    falharAoLer: false,
    atrasoDaLeitura: 0,
    async getAllKeys() {
      if (this.falharAoLer) throw new Error('falha de leitura');
      return [...dados.keys()];
    },
    async multiGet(chaves) {
      if (this.falharAoLer) throw new Error('falha de leitura');
      const resposta = chaves.map((chave) => [chave, dados.get(chave) ?? null]);
      if (this.atrasoDaLeitura > 0) {
        const atraso = this.atrasoDaLeitura;
        this.atrasoDaLeitura = 0;
        await new Promise((resolver) => setTimeout(resolver, atraso));
      }
      return resposta;
    },
    async setItem(chave, valor) {
      if (this.falharAoGravar) throw new Error('falha de gravacao');
      dados.set(chave, valor);
    },
  };
}

// Dados neutros: nenhuma prova real.
const gabarito = (examVersionId = 'versao-a', sobrescrita = {}) => ({
  examVersionId,
  capturedAt: ANTES,
  objectiveQuestions: [
    {
      questionId: 'q1',
      correctAlternativeId: 'q1-b',
      printedOrder: ['q1-a', 'q1-b', 'q1-c'],
      score: 1.5,
    },
  ],
  discursiveQuestions: [{ questionId: 'q2', maxScore: 3 }],
  ...sobrescrita,
});

const objetiva = (sobrescrita) => ({
  objectiveQuestions: [{ ...gabarito().objectiveQuestions[0], ...sobrescrita }],
});

const INVALIDOS = {
  nulo: null,
  texto: 'gabarito',
  lista: [],
  'sem versao': gabarito('versao-a', { examVersionId: undefined }),
  'versao vazia': gabarito(''),
  'sem data': gabarito('versao-a', { capturedAt: undefined }),
  'data invalida': gabarito('versao-a', { capturedAt: 'ontem' }),
  'data sem fuso': gabarito('versao-a', { capturedAt: '2026-01-01T10:00:00' }),
  'data impossivel': gabarito('versao-a', { capturedAt: '2026-13-01T10:00:00.000Z' }),
  'dia inexistente no mes': gabarito('versao-a', { capturedAt: '2026-02-31T10:00:00.000Z' }),
  '29 de fevereiro fora de ano bissexto': gabarito('versao-a', {
    capturedAt: '2026-02-29T10:00:00.000Z',
  }),
  'sem objetivas': gabarito('versao-a', { objectiveQuestions: undefined }),
  'sem discursivas': gabarito('versao-a', { discursiveQuestions: undefined }),
  'sem questoes': gabarito('versao-a', { objectiveQuestions: [], discursiveQuestions: [] }),
  'objetiva sem id': gabarito('versao-a', objetiva({ questionId: '' })),
  'correta fora da ordem impressa': gabarito('versao-a', objetiva({ correctAlternativeId: 'x' })),
  'menos de 2 alternativas': gabarito(
    'versao-a',
    objetiva({ printedOrder: ['q1-b'], correctAlternativeId: 'q1-b' }),
  ),
  'mais de 5 alternativas': gabarito(
    'versao-a',
    objetiva({ printedOrder: ['a', 'b', 'c', 'd', 'e', 'q1-b'] }),
  ),
  'alternativa repetida': gabarito(
    'versao-a',
    objetiva({ printedOrder: ['q1-b', 'q1-b', 'q1-c'] }),
  ),
  'pontuacao negativa': gabarito('versao-a', objetiva({ score: -1 })),
  'pontuacao nao numerica': gabarito('versao-a', objetiva({ score: '1' })),
  'pontuacao infinita': gabarito('versao-a', objetiva({ score: Infinity })),
  'discursiva sem maximo': gabarito('versao-a', {
    discursiveQuestions: [{ questionId: 'q2' }],
  }),
  'questao repetida': gabarito('versao-a', {
    discursiveQuestions: [{ questionId: 'q1', maxScore: 3 }],
  }),
};

describe('salvar e carregar gabaritos', () => {
  it('salva e carrega o gabarito completo, com capturedAt', async () => {
    const locais = criarGabaritosLocais(criarArmazenamento());
    assert.equal(await locais.salvar(gabarito()), 'salvo');
    const carregado = await locais.carregar('versao-a');
    assert.deepEqual(carregado, gabarito());
    assert.equal(carregado.capturedAt, ANTES);
  });

  it('persiste entre instancias, como ao reabrir o aplicativo', async () => {
    const armazenamento = criarArmazenamento();
    await criarGabaritosLocais(armazenamento).salvar(gabarito());
    assert.deepEqual(await criarGabaritosLocais(armazenamento).carregar('versao-a'), gabarito());
  });

  it('persiste mais de uma versao, cada uma em sua chave', async () => {
    const armazenamento = criarArmazenamento();
    const locais = criarGabaritosLocais(armazenamento);
    await locais.salvar(gabarito('versao-a'));
    await locais.salvar(gabarito('versao-b'));

    assert.deepEqual([...armazenamento.dados.keys()], [`${PREFIXO}versao-a`, `${PREFIXO}versao-b`]);
    assert.equal((await locais.carregar('versao-a')).examVersionId, 'versao-a');
    assert.equal((await locais.carregar('versao-b')).examVersionId, 'versao-b');
  });

  it('versao inexistente volta como ausente', async () => {
    const locais = criarGabaritosLocais(criarArmazenamento());
    assert.equal(await locais.carregar('versao-x'), undefined);
  });
});

describe('substituir uma versao', () => {
  const novo = gabarito('versao-a', {
    capturedAt: DEPOIS,
    discursiveQuestions: [{ questionId: 'q2', maxScore: 5 }],
  });

  it('substitui por uma atualizacao mais recente, sem duplicar', async () => {
    const armazenamento = criarArmazenamento();
    const locais = criarGabaritosLocais(armazenamento);
    await locais.salvar(gabarito());

    assert.equal(await locais.salvar(novo), 'salvo');
    assert.deepEqual(await locais.carregar('versao-a'), novo);
    assert.equal(armazenamento.dados.size, 1);
  });

  it('mantem a copia atual ao receber uma mais antiga', async () => {
    const locais = criarGabaritosLocais(criarArmazenamento());
    await locais.salvar(novo);
    assert.equal(await locais.salvar(gabarito()), 'mantido');
    assert.deepEqual(await locais.carregar('versao-a'), novo);
  });

  it('mantem a copia atual ao receber a mesma data', async () => {
    const locais = criarGabaritosLocais(criarArmazenamento());
    await locais.salvar(gabarito());
    const mesmaData = gabarito('versao-a', { discursiveQuestions: [] });
    assert.equal(await locais.salvar(mesmaData), 'mantido');
    assert.deepEqual(await locais.carregar('versao-a'), gabarito());
  });

  it('compara o instante real, mesmo com fusos diferentes', async () => {
    const locais = criarGabaritosLocais(criarArmazenamento());
    await locais.salvar(gabarito('versao-a', { capturedAt: '2026-01-01T12:00:00.000Z' }));
    // Como texto pareceria mais recente, mas e 11:00 em UTC.
    const anterior = gabarito('versao-a', { capturedAt: '2026-01-01T13:00:00.000+02:00' });
    assert.equal(await locais.salvar(anterior), 'mantido');
  });

  it('gravacoes simultaneas nao deixam a copia antiga vencer', async () => {
    const armazenamento = criarArmazenamento();
    const locais = criarGabaritosLocais(armazenamento);
    armazenamento.atrasoDaLeitura = 20;

    const resultados = await Promise.all([locais.salvar(novo), locais.salvar(gabarito())]);
    assert.deepEqual(resultados, ['salvo', 'mantido']);
    assert.deepEqual(await locais.carregar('versao-a'), novo);
  });

  it('uma copia corrompida pode ser substituida por uma valida', async () => {
    const armazenamento = criarArmazenamento();
    armazenamento.dados.set(`${PREFIXO}versao-a`, '{quebrado');
    const locais = criarGabaritosLocais(armazenamento);
    assert.equal(await locais.salvar(gabarito()), 'salvo');
    assert.deepEqual(await locais.carregar('versao-a'), gabarito());
  });

  it('falha ao gravar rejeita, preserva a copia e nao trava as proximas', async () => {
    const armazenamento = criarArmazenamento();
    const locais = criarGabaritosLocais(armazenamento);
    await locais.salvar(gabarito());

    armazenamento.falharAoGravar = true;
    await assert.rejects(locais.salvar(novo));
    assert.deepEqual(await locais.carregar('versao-a'), gabarito());

    armazenamento.falharAoGravar = false;
    assert.equal(await locais.salvar(novo), 'salvo');
  });
});

describe('listar gabaritos', () => {
  it('armazenamento vazio devolve lista vazia', async () => {
    assert.deepEqual(await criarGabaritosLocais(criarArmazenamento()).listar(), {
      gabaritos: [],
      chavesIlegiveis: [],
    });
  });

  it('lista as versoes ordenadas', async () => {
    const locais = criarGabaritosLocais(criarArmazenamento());
    await locais.salvar(gabarito('versao-c'));
    await locais.salvar(gabarito('versao-a'));
    await locais.salvar(gabarito('versao-b'));

    const { gabaritos, chavesIlegiveis } = await locais.listar();
    assert.deepEqual(
      gabaritos.map((item) => item.examVersionId),
      ['versao-a', 'versao-b', 'versao-c'],
    );
    assert.deepEqual(chavesIlegiveis, []);
  });

  for (const [nome, conteudo] of [
    ['JSON quebrado', '{quebrado'],
    ['valor nao objeto', '123'],
    ['gabarito incompleto', JSON.stringify({ examVersionId: 'versao-ruim' })],
    ['versao diferente da chave', JSON.stringify(gabarito('outra-versao'))],
  ]) {
    it(`${nome} e relatado, mantido e nao impede as outras versoes`, async () => {
      const armazenamento = criarArmazenamento();
      const locais = criarGabaritosLocais(armazenamento);
      await locais.salvar(gabarito('versao-boa'));
      armazenamento.dados.set(`${PREFIXO}versao-ruim`, conteudo);

      const { gabaritos, chavesIlegiveis } = await locais.listar();
      assert.deepEqual(
        gabaritos.map((item) => item.examVersionId),
        ['versao-boa'],
      );
      assert.deepEqual(chavesIlegiveis, [`${PREFIXO}versao-ruim`]);
      assert.equal(await locais.carregar('versao-ruim'), undefined);
      assert.equal(armazenamento.dados.get(`${PREFIXO}versao-ruim`), conteudo);
      assert.equal((await locais.carregar('versao-boa')).examVersionId, 'versao-boa');
    });
  }

  it('propaga falha de leitura do armazenamento', async () => {
    const armazenamento = criarArmazenamento();
    const locais = criarGabaritosLocais(armazenamento);
    armazenamento.falharAoLer = true;
    await assert.rejects(locais.listar());
    await assert.rejects(locais.carregar('versao-a'));
  });
});

describe('dados invalidos', () => {
  it('aceita um gabarito valido, inclusive so com objetivas ou so discursivas', () => {
    assert.equal(gabaritoValido(gabarito()), true);
    assert.equal(gabaritoValido(gabarito('versao-a', { discursiveQuestions: [] })), true);
    assert.equal(gabaritoValido(gabarito('versao-a', { objectiveQuestions: [] })), true);
  });

  it('aceita 29 de fevereiro em ano bissexto', () => {
    assert.equal(
      gabaritoValido(gabarito('versao-a', { capturedAt: '2028-02-29T10:00:00Z' })),
      true,
    );
  });

  for (const [nome, valor] of Object.entries(INVALIDOS)) {
    it(`recusa ao salvar: ${nome}`, async () => {
      const armazenamento = criarArmazenamento();
      const locais = criarGabaritosLocais(armazenamento);
      assert.equal(gabaritoValido(valor), false);
      assert.equal(await locais.salvar(valor), 'invalido');
      assert.equal(armazenamento.dados.size, 0);
    });
  }

  it('dado invalido nao substitui uma copia valida', async () => {
    const locais = criarGabaritosLocais(criarArmazenamento());
    await locais.salvar(gabarito());
    const invalido = gabarito('versao-a', { capturedAt: DEPOIS, objectiveQuestions: 'x' });
    assert.equal(await locais.salvar(invalido), 'invalido');
    assert.deepEqual(await locais.carregar('versao-a'), gabarito());
  });
});

describe('gabarito usado pelo estado das correcoes', () => {
  // versao-1 tem gabarito nos mocks; versao-4 tem as mesmas questoes impressas, mas nao tem.
  const COM_MOCK = 'versao-1';
  const SEM_MOCK = 'versao-4';
  const doMock = () =>
    mocks.filaCorrecoesMock.find((item) => item.examVersionId === COM_MOCK).answerKeySnapshot;
  const persistido = () => ({
    ...doMock(),
    capturedAt: '2026-06-01T10:00:00.000Z',
    objectiveQuestions: doMock().objectiveQuestions.map((questao) => ({
      ...questao,
      score: questao.score + 1,
    })),
  });
  const abrirCom = async (armazenamento) => iniciarFilaPersistente(armazenamento);

  it('o gabarito persistido tem prioridade sobre o mock', async () => {
    const armazenamento = criarArmazenamento();
    await criarGabaritosLocais(armazenamento).salvar(persistido());
    await abrirCom(armazenamento);

    assert.deepEqual(obterGabaritoDaVersao(COM_MOCK), persistido());
    assert.notDeepEqual(obterGabaritoDaVersao(COM_MOCK), doMock());
  });

  it('a prova a corrigir usa a pontuacao do gabarito persistido', async () => {
    const armazenamento = criarArmazenamento();
    await criarGabaritosLocais(armazenamento).salvar(persistido());
    await abrirCom(armazenamento);

    assert.deepEqual(
      obterProvaParaCorrigir(COM_MOCK).objetivas.map((questao) => questao.pontuacao),
      persistido().objectiveQuestions.map((questao) => questao.score),
    );
  });

  it('versao sem mock funciona quando tem gabarito persistido', async () => {
    const armazenamento = criarArmazenamento();
    const proprio = { ...persistido(), examVersionId: SEM_MOCK };
    await criarGabaritosLocais(armazenamento).salvar(proprio);
    await abrirCom(armazenamento);

    assert.deepEqual(obterGabaritoDaVersao(SEM_MOCK), proprio);
  });

  it('sem gabarito persistido, o mock continua funcionando', async () => {
    await abrirCom(criarArmazenamento());
    assert.deepEqual(obterGabaritoDaVersao(COM_MOCK), doMock());
    assert.ok(obterProvaParaCorrigir(COM_MOCK));
  });

  it('versao sem cache e sem mock continua sem gabarito', async () => {
    await abrirCom(criarArmazenamento());
    assert.equal(obterGabaritoDaVersao(SEM_MOCK), undefined);
    assert.equal(obterGabaritoDaVersao('versao-inexistente'), undefined);
    assert.equal(obterProvaParaCorrigir(SEM_MOCK), undefined);
  });

  for (const [nome, conteudo] of [
    ['JSON quebrado', '{quebrado'],
    ['gabarito incompleto', JSON.stringify({ examVersionId: COM_MOCK })],
    ['gabarito de outra versao', JSON.stringify({ ...persistido(), examVersionId: 'versao-2' })],
  ]) {
    it(`cache invalido (${nome}) nao quebra o fallback para o mock`, async () => {
      const armazenamento = criarArmazenamento();
      armazenamento.dados.set(`${PREFIXO}${COM_MOCK}`, conteudo);
      await abrirCom(armazenamento);

      assert.deepEqual(obterGabaritoDaVersao(COM_MOCK), doMock());
      assert.equal(armazenamento.dados.get(`${PREFIXO}${COM_MOCK}`), conteudo);
    });
  }

  it('cache invalido de uma versao nao afeta outra versao valida', async () => {
    const armazenamento = criarArmazenamento();
    const proprio = { ...persistido(), examVersionId: SEM_MOCK };
    await criarGabaritosLocais(armazenamento).salvar(proprio);
    armazenamento.dados.set(`${PREFIXO}${COM_MOCK}`, '{quebrado');
    await abrirCom(armazenamento);

    assert.deepEqual(obterGabaritoDaVersao(SEM_MOCK), proprio);
    assert.deepEqual(obterGabaritoDaVersao(COM_MOCK), doMock());
  });

  it('gabarito ilegivel nao conta como correcao ilegivel', async () => {
    const armazenamento = criarArmazenamento();
    armazenamento.dados.set(`${PREFIXO}${COM_MOCK}`, '{quebrado');
    await abrirCom(armazenamento);
    assert.equal(contarCorrecoesIlegiveis(), 0);
  });

  const incompativeis = () => ({
    'questao fora do layout': {
      ...persistido(),
      discursiveQuestions: [
        ...persistido().discursiveQuestions.slice(1),
        { questionId: 'q-fora-do-layout', maxScore: 1 },
      ],
    },
    'questao do layout ausente': {
      ...persistido(),
      discursiveQuestions: persistido().discursiveQuestions.slice(1),
    },
    'ordem das alternativas diferente da impressa': {
      ...persistido(),
      objectiveQuestions: persistido().objectiveQuestions.map((questao, indice) =>
        indice === 0 ? { ...questao, printedOrder: [...questao.printedOrder].reverse() } : questao,
      ),
    },
  });

  for (const nome of Object.keys(incompativeis())) {
    it(`gabarito incompativel (${nome}) nao e usado e volta ao mock`, async () => {
      const armazenamento = criarArmazenamento();
      const gabaritoSalvo = incompativeis()[nome];
      assert.equal(gabaritoValido(gabaritoSalvo), true);
      await criarGabaritosLocais(armazenamento).salvar(gabaritoSalvo);
      await abrirCom(armazenamento);

      assert.deepEqual(obterGabaritoDaVersao(COM_MOCK), doMock());
      assert.equal(armazenamento.dados.size, 1);
    });
  }

  it('gabarito incompativel de versao sem mock deixa a versao sem gabarito', async () => {
    const armazenamento = criarArmazenamento();
    await criarGabaritosLocais(armazenamento).salvar({
      ...incompativeis()['questao do layout ausente'],
      examVersionId: SEM_MOCK,
    });
    await abrirCom(armazenamento);
    assert.equal(obterGabaritoDaVersao(SEM_MOCK), undefined);
    assert.equal(obterProvaParaCorrigir(SEM_MOCK), undefined);
  });

  it('gabarito de versao desconhecida nao e usado', async () => {
    const armazenamento = criarArmazenamento();
    await criarGabaritosLocais(armazenamento).salvar({
      ...persistido(),
      examVersionId: 'versao-desconhecida',
    });
    await abrirCom(armazenamento);
    assert.equal(obterGabaritoDaVersao('versao-desconhecida'), undefined);
  });

  it('layout sem ordem de alternativas confere apenas as questoes', () => {
    const layout = {
      questionOrder: ['q2', 'q1'],
      alternativeOrder: [],
    };
    assert.equal(gabaritoCompativelComLayout(gabarito(), layout), true);
  });

  it('o mock nao e gravado automaticamente no cache', async () => {
    const armazenamento = criarArmazenamento();
    await abrirCom(armazenamento);
    obterGabaritoDaVersao(COM_MOCK);
    obterProvaParaCorrigir(COM_MOCK);

    assert.equal(armazenamento.dados.size, 0);
    assert.deepEqual((await criarGabaritosLocais(armazenamento).listar()).gabaritos, []);
  });

  it('a correcao confirmada guarda o gabarito persistido no snapshot', async () => {
    const armazenamento = criarArmazenamento();
    await criarGabaritosLocais(armazenamento).salvar(persistido());
    await abrirCom(armazenamento);

    const { item } = await enfileirarCorrecao({
      examVersionId: COM_MOCK,
      studentId: 'aluno-ficticio',
      objectiveAnswers: [],
      discursiveScores: [],
    });
    assert.deepEqual(item.answerKeySnapshot, persistido());
  });

  it('atualizar o cache nao altera o snapshot de correcao ja confirmada', async () => {
    const armazenamento = criarArmazenamento();
    const locais = criarGabaritosLocais(armazenamento);
    await locais.salvar(persistido());
    await abrirCom(armazenamento);
    const { item } = await enfileirarCorrecao({
      examVersionId: COM_MOCK,
      studentId: 'aluno-ficticio',
      objectiveAnswers: [],
      discursiveScores: [],
    });

    const maisNovo = { ...persistido(), capturedAt: '2026-07-01T10:00:00.000Z' };
    await locais.salvar(maisNovo);
    await abrirCom(armazenamento);

    assert.deepEqual(obterGabaritoDaVersao(COM_MOCK), maisNovo);
    const reaberto = listarFila().find((i) => i.clientCorrectionId === item.clientCorrectionId);
    assert.equal(reaberto.answerKeySnapshot.capturedAt, persistido().capturedAt);
  });

  it('falha ao ler nao aplica carga parcial', async () => {
    const armazenamento = criarArmazenamento();
    await criarGabaritosLocais(armazenamento).salvar(persistido());
    await abrirCom(armazenamento);

    armazenamento.falharAoLer = true;
    await assert.rejects(abrirCom(armazenamento));
    assert.deepEqual(obterGabaritoDaVersao(COM_MOCK), persistido());
  });

  it('nova carga remove da memoria o gabarito que nao esta mais salvo', async () => {
    const armazenamento = criarArmazenamento();
    await criarGabaritosLocais(armazenamento).salvar(persistido());
    await abrirCom(armazenamento);

    await abrirCom(criarArmazenamento());
    assert.deepEqual(obterGabaritoDaVersao(COM_MOCK), doMock());
  });
});

describe('separacao da fila de correcoes', () => {
  const itemDaFila = {
    clientCorrectionId: 'versao-a',
    examVersionId: 'versao-a',
    objectiveAnswers: [],
    discursiveScores: [],
    answerKeySnapshot: gabarito(),
    capturedAt: ANTES,
    syncStatus: 'pending',
  };

  it('usa chaves diferentes mesmo com o mesmo identificador', async () => {
    const armazenamento = criarArmazenamento();
    await criarGabaritosLocais(armazenamento).salvar(gabarito());
    await criarFilaPersistente(armazenamento).salvar(itemDaFila);

    const chaves = [...armazenamento.dados.keys()];
    assert.equal(chaves.length, 2);
    assert.equal(new Set(chaves).size, 2);
    assert.equal(chaves.filter((chave) => chave.startsWith(PREFIXO)).length, 1);
  });

  it('a fila nao le gabaritos e os gabaritos nao leem a fila', async () => {
    const armazenamento = criarArmazenamento();
    const locais = criarGabaritosLocais(armazenamento);
    const fila = criarFilaPersistente(armazenamento);
    await locais.salvar(gabarito());
    await fila.salvar(itemDaFila);

    assert.deepEqual(await fila.carregar(), { itens: [itemDaFila], chavesIlegiveis: [] });
    assert.deepEqual(await locais.listar(), { gabaritos: [gabarito()], chavesIlegiveis: [] });
  });

  it('atualizar o gabarito local nao altera o snapshot do item da fila', async () => {
    const armazenamento = criarArmazenamento();
    const locais = criarGabaritosLocais(armazenamento);
    const fila = criarFilaPersistente(armazenamento);
    await locais.salvar(gabarito());
    await fila.salvar(itemDaFila);

    await locais.salvar(gabarito('versao-a', { capturedAt: DEPOIS }));
    const { itens } = await fila.carregar();
    assert.equal(itens[0].answerKeySnapshot.capturedAt, ANTES);
  });
});
