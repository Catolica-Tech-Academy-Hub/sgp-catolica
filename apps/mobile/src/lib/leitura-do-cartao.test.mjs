import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lerBolhas } from '../viabilidade/bolhas.ts';
import { criarLayoutProvisorioDeBolhas } from '../viabilidade/layout-provisorio.ts';
import { detectarMarcadores, LAYOUT_PROVISORIO } from '../viabilidade/marcadores.ts';
import { aplicarHomografia, calcularPerspectiva } from '../viabilidade/perspectiva.ts';
import {
  aplicarNaConferencia,
  contarPendentes,
  executarLeitura,
  interpretarLeitura,
  leituraConfirmaSugestaoAnterior,
  lerCartao,
  listarDivergencias,
  marcarDivergencias,
  mensagemDeSugestaoRepetida,
  montarAplicacao,
  registrarBranco,
  registrarToque,
  resolverQuestao,
  rotuloDaDecisaoManual,
  rotuloDaPendencia,
} from './leitura-do-cartao.ts';

// Identificadores neutros: nenhum dado de aluno ou de prova real.
const questao = (n) => ({
  questionId: `q${n}`,
  alternativas: ['a', 'b', 'c', 'd', 'e'].map((sufixo, i) => ({
    id: `q${n}-${sufixo}`,
    letra: 'ABCDE'[i],
  })),
});
const QUESTOES = [questao(0), questao(1), questao(2), questao(3)];
const VAZIO = { marcadas: {}, emBranco: [], sugeridasPelaLeitura: [], divergentes: {} };

const sugestao = (estado, n = 0, alternativaSugeridaId, alternativasDetectadasIds = []) => ({
  questionId: `q${n}`,
  estado,
  alternativaSugeridaId,
  alternativasDetectadasIds,
});

const nucleo = {
  detectar: (imagem) => detectarMarcadores(imagem, LAYOUT_PROVISORIO),
  calcularPerspectiva: (marcadores) => calcularPerspectiva(marcadores, LAYOUT_PROVISORIO),
  aplicarHomografia,
  lerBolhas,
  criarLayout: criarLayoutProvisorioDeBolhas,
};

/** Cartao sintetico a 4 px/mm: `marcas` e a lista de opcoes cheias e meias por questao. */
function desenharCartao(marcas) {
  const px = 4;
  const largura = 210 * px;
  const altura = 297 * px;
  const dados = new Uint8Array(largura * altura * 4).fill(235);
  const pintar = (x, y) => {
    const i = (y * largura + x) * 4;
    dados[i] = dados[i + 1] = dados[i + 2] = 25;
  };
  const quadrado = (cx, cy, vazado) => {
    for (let y = (cy - 5) * px; y < (cy + 5) * px; y += 1) {
      for (let x = (cx - 5) * px; x < (cx + 5) * px; x += 1) {
        const noFuro = Math.abs(x / px - cx) < 2 && Math.abs(y / px - cy) < 2;
        if (!(vazado && noFuro)) pintar(x, y);
      }
    }
  };
  quadrado(15, 15, true);
  quadrado(195, 15);
  quadrado(195, 282);
  quadrado(15, 282);

  const layout = criarLayoutProvisorioDeBolhas(marcas.map(() => 5));
  layout.questoes.forEach(({ bolhas }, q) => {
    for (const { indiceDaOpcao, centroMm } of bolhas) {
      const tipo = marcas[q][indiceDaOpcao];
      for (let y = (centroMm.y - 3) * px; y <= (centroMm.y + 3) * px; y += 1) {
        for (let x = (centroMm.x - 3) * px; x <= (centroMm.x + 3) * px; x += 1) {
          const dx = x / px - centroMm.x;
          const dy = y / px - centroMm.y;
          const d = Math.hypot(dx, dy);
          if (d > 3) continue;
          if (d >= 2.75 || tipo === 'cheia' || (tipo === 'meia' && dy >= 0)) pintar(x, y);
        }
      }
    }
  });
  return { largura, altura, dados };
}

describe('interpretacao da leitura', () => {
  const bolha = (indiceDaOpcao, estado) => ({
    indiceDaOpcao,
    estado,
    preenchimento: 0,
    confianca: 1,
  });

  it('traduz a posicao lida para a alternativa impressa', () => {
    const [s] = interpretarLeitura(
      [questao(0)],
      [
        {
          indiceDaQuestao: 0,
          estado: 'respondida',
          indiceMarcado: 2,
          bolhas: [bolha(2, 'marcada')],
        },
      ],
    );
    assert.equal(s.estado, 'respondida');
    assert.equal(s.alternativaSugeridaId, 'q0-c');
  });

  it('nao escolhe alternativa na dupla marcacao', () => {
    const [s] = interpretarLeitura(
      [questao(0)],
      [
        {
          indiceDaQuestao: 0,
          estado: 'multipla',
          bolhas: [bolha(0, 'marcada'), bolha(3, 'marcada')],
        },
      ],
    );
    assert.equal(s.estado, 'multipla');
    assert.equal(s.alternativaSugeridaId, undefined);
    assert.deepEqual(s.alternativasDetectadasIds, ['q0-a', 'q0-d']);
  });

  it('manda para revisao um indice que nao existe na questao', () => {
    const [s] = interpretarLeitura(
      [questao(0)],
      [{ indiceDaQuestao: 0, estado: 'respondida', indiceMarcado: 9, bolhas: [] }],
    );
    assert.equal(s.estado, 'revisar');
    assert.equal(s.alternativaSugeridaId, undefined);
  });

  it('recusa leitura com numero de questoes diferente da prova', () => {
    assert.equal(interpretarLeitura(QUESTOES, []), undefined);
  });
});

describe('prioridade da decisao', () => {
  it('marcacao atual vence a sugestao da camera', () => {
    const r = resolverQuestao(
      sugestao('respondida', 0, 'q0-c'),
      { marcadas: { q0: 'q0-a' }, emBranco: [], sugeridasPelaLeitura: [], divergentes: {} },
      {},
    );
    assert.deepEqual(r, { origem: 'atual', valor: 'q0-a' });
  });

  it('toque na revisao vence a marcacao atual', () => {
    const r = resolverQuestao(
      sugestao('respondida', 0, 'q0-c'),
      { marcadas: { q0: 'q0-a' }, emBranco: [], sugeridasPelaLeitura: [], divergentes: {} },
      { q0: 'q0-b' },
    );
    assert.deepEqual(r, { origem: 'revisao', valor: 'q0-b' });
  });

  for (const estado of ['multipla', 'revisar']) {
    it(`${estado} fica pendente ate o professor decidir`, () => {
      const s = sugestao(estado);
      assert.equal(resolverQuestao(s, VAZIO, {}).origem, 'pendente');
      assert.equal(contarPendentes([s], VAZIO, {}), 1);
      assert.equal(montarAplicacao('x', 'v', [s], VAZIO, {}), undefined);
      assert.equal(contarPendentes([s], VAZIO, { q0: null }), 0);
    });
  }

  it('questao em branco segue sem resposta', () => {
    assert.deepEqual(resolverQuestao(sugestao('em_branco'), VAZIO, {}), {
      origem: 'leitura',
      valor: null,
    });
  });
});

describe('aplicacao na conferencia', () => {
  const aplicar = (atuais, sugestoes, revisoes = {}) =>
    aplicarNaConferencia(
      atuais,
      montarAplicacao('id', 'v1', sugestoes, atuais, revisoes),
      QUESTOES,
      'v1',
    );

  it('aplica sugestoes seguras e registra o branco fora das respostas', () => {
    const r = aplicar(VAZIO, [sugestao('respondida', 0, 'q0-c'), sugestao('em_branco', 1)]);
    assert.deepEqual(r.marcadas, { q0: 'q0-c' });
    assert.deepEqual(r.emBranco, ['q1']);
  });

  it('nao sobrescreve marcacao manual nem muta o estado original', () => {
    const atuais = {
      marcadas: { q0: 'q0-a' },
      emBranco: [],
      sugeridasPelaLeitura: [],
      divergentes: {},
    };
    const r = aplicar(atuais, [sugestao('respondida', 0, 'q0-c')]);
    assert.deepEqual(r.marcadas, { q0: 'q0-a' });
    assert.deepEqual(atuais, {
      marcadas: { q0: 'q0-a' },
      emBranco: [],
      sugeridasPelaLeitura: [],
      divergentes: {},
    });
  });

  it('sugestao adulterada da camera nao sobrescreve marcacao manual', () => {
    const atuais = {
      marcadas: { q0: 'q0-a' },
      emBranco: [],
      sugeridasPelaLeitura: [],
      divergentes: {},
    };
    const aplicacao = {
      id: 'x',
      examVersionId: 'v1',
      decisoes: [{ questionId: 'q0', valor: 'q0-c', origem: 'leitura' }],
    };
    assert.deepEqual(
      aplicarNaConferencia(atuais, aplicacao, QUESTOES, 'v1').marcadas,
      atuais.marcadas,
    );
  });

  it('revisao troca uma marcacao por branco e vice-versa', () => {
    const r1 = aplicar(
      { marcadas: { q0: 'q0-a' }, emBranco: [], sugeridasPelaLeitura: [], divergentes: {} },
      [sugestao('revisar')],
      {
        q0: null,
      },
    );
    assert.deepEqual(r1, {
      marcadas: {},
      emBranco: ['q0'],
      sugeridasPelaLeitura: [],
      divergentes: {},
    });
    const r2 = aplicar(r1, [sugestao('revisar')], { q0: 'q0-b' });
    assert.deepEqual(r2, {
      marcadas: { q0: 'q0-b' },
      emBranco: [],
      sugeridasPelaLeitura: [],
      divergentes: {},
    });
  });

  it('ignora aceite de outra versao e alternativa de outra questao', () => {
    const aplicacao = {
      id: 'x',
      examVersionId: 'outra',
      decisoes: [{ questionId: 'q0', valor: 'q0-a', origem: 'revisao' }],
    };
    assert.deepEqual(aplicarNaConferencia(VAZIO, aplicacao, QUESTOES, 'v1'), VAZIO);
    const invalida = {
      ...aplicacao,
      examVersionId: 'v1',
      decisoes: [{ questionId: 'q0', valor: 'q1-a', origem: 'revisao' }],
    };
    assert.deepEqual(aplicarNaConferencia(VAZIO, invalida, QUESTOES, 'v1').marcadas, {});
  });
});

describe('segunda leitura', () => {
  const QUESTAO = [questao(0)];
  const aplicar = (atuais, sugestoes, revisoes = {}) =>
    aplicarNaConferencia(
      atuais,
      montarAplicacao('id', 'v1', sugestoes, atuais, revisoes),
      QUESTAO,
      'v1',
    );
  const bolha = (indiceDaOpcao, estado) => ({
    indiceDaOpcao,
    estado,
    preenchimento: 0,
    confianca: 0,
  });
  const lida = (estado, bolhas) =>
    interpretarLeitura(QUESTAO, [{ indiceDaQuestao: 0, estado, bolhas }]);
  const seguraC = [sugestao('respondida', 0, 'q0-c', ['q0-c'])];
  const aposPrimeira = () => aplicar(VAZIO, seguraC);

  it('a) primeira leitura segura aplica a sugestao sem virar decisao manual', () => {
    assert.deepEqual(aposPrimeira(), {
      marcadas: { q0: 'q0-c' },
      emBranco: [],
      sugeridasPelaLeitura: ['q0'],
      divergentes: {},
    });
  });

  const DIVERGENTES = {
    'b) ambigua': () => lida('revisar', [bolha(2, 'ambigua')]),
    'c) dupla': () => lida('multipla', [bolha(0, 'marcada'), bolha(2, 'marcada')]),
    'd) nao localizada': () => lida('revisar', [bolha(2, 'nao_localizada')]),
    'e) em branco': () => lida('em_branco', [bolha(2, 'vazia')]),
    'outra letra segura': () => [sugestao('respondida', 0, 'q0-a', ['q0-a'])],
  };

  for (const [nome, criar] of Object.entries(DIVERGENTES)) {
    it(`${nome} volta para revisao obrigatoria sem trocar nem manter o valor`, () => {
      const atuais = aposPrimeira();
      const sugestoes = criar();

      assert.deepEqual(resolverQuestao(sugestoes[0], atuais, {}), {
        origem: 'pendente',
        valorAnterior: 'q0-c',
      });
      assert.equal(contarPendentes(sugestoes, atuais, {}), 1);
      assert.equal(montarAplicacao('id', 'v1', sugestoes, atuais, {}), undefined);
      assert.deepEqual(atuais.marcadas, { q0: 'q0-c' });

      const decidida = aplicar(atuais, sugestoes, { q0: 'q0-b' });
      assert.deepEqual(decidida, {
        marcadas: { q0: 'q0-b' },
        emBranco: [],
        sugeridasPelaLeitura: [],
        divergentes: {},
      });
    });
  }

  it('branco sugerido antes tambem volta para revisao quando a nova leitura difere', () => {
    const atuais = aplicar(VAZIO, [sugestao('em_branco')]);
    assert.deepEqual(resolverQuestao(seguraC[0], atuais, {}), {
      origem: 'pendente',
      valorAnterior: null,
    });
  });

  it('nova leitura segura com o mesmo valor confirma a sugestao', () => {
    const atuais = aposPrimeira();
    assert.deepEqual(resolverQuestao(seguraC[0], atuais, {}), { origem: 'atual', valor: 'q0-c' });
    assert.deepEqual(aplicar(atuais, seguraC), atuais);
  });

  it('f) toque depois da leitura passa a ter prioridade', () => {
    const tocada = registrarToque(aposPrimeira(), 'q0', 'q0-b');
    assert.deepEqual(tocada, {
      marcadas: { q0: 'q0-b' },
      emBranco: [],
      sugeridasPelaLeitura: [],
      divergentes: {},
    });
  });

  it('f) tocar na mesma letra sugerida tambem vira decisao manual', () => {
    const tocada = registrarToque(aposPrimeira(), 'q0', 'q0-c');
    assert.deepEqual(tocada.sugeridasPelaLeitura, []);
    assert.equal(contarPendentes(DIVERGENTES['c) dupla'](), tocada, {}), 0);
  });

  it('toque tira a questao do branco sugerido', () => {
    const atuais = aplicar(VAZIO, [sugestao('em_branco')]);
    assert.deepEqual(registrarToque(atuais, 'q0', 'q0-a'), {
      marcadas: { q0: 'q0-a' },
      emBranco: [],
      sugeridasPelaLeitura: [],
      divergentes: {},
    });
  });

  for (const [nome, criar] of Object.entries({ ...DIVERGENTES, 'segura C': () => seguraC })) {
    it(`g) nova leitura (${nome}) nao sobrescreve decisao manual`, () => {
      const manual = registrarToque(aposPrimeira(), 'q0', 'q0-b');
      const sugestoes = criar();

      assert.deepEqual(resolverQuestao(sugestoes[0], manual, {}), {
        origem: 'atual',
        valor: 'q0-b',
      });
      assert.equal(contarPendentes(sugestoes, manual, {}), 0);
      assert.deepEqual(aplicar(manual, sugestoes), manual);
    });
  }

  const sairSemDecidir = (atuais, sugestoes) =>
    marcarDivergencias(
      atuais,
      {
        id: 'leitura-2',
        examVersionId: 'v1',
        valoresAnteriores: listarDivergencias(sugestoes, atuais),
      },
      'v1',
    );

  for (const [nome, criar] of Object.entries(DIVERGENTES)) {
    it(`voltar com divergencia (${nome}) deixa a questao pendente na conferencia`, () => {
      const pendente = sairSemDecidir(aposPrimeira(), criar());
      assert.deepEqual(pendente, {
        marcadas: {},
        emBranco: [],
        sugeridasPelaLeitura: [],
        divergentes: { q0: 'q0-c' },
      });
    });
  }

  it('divergencia pendente nao se resolve com outra leitura segura', () => {
    const pendente = sairSemDecidir(aposPrimeira(), DIVERGENTES['c) dupla']());
    assert.deepEqual(resolverQuestao(seguraC[0], pendente, {}), {
      origem: 'pendente',
      valorAnterior: 'q0-c',
    });
    assert.equal(montarAplicacao('id', 'v1', seguraC, pendente, {}), undefined);
  });

  for (const nome of ['b) ambigua', 'c) dupla', 'd) nao localizada']) {
    it(`terceira leitura igual apos ${nome} segue pendente sem dizer que divergiu`, () => {
      const pendente = sairSemDecidir(aposPrimeira(), DIVERGENTES[nome]());
      const resolucao = resolverQuestao(seguraC[0], pendente, {});

      assert.deepEqual(resolucao, { origem: 'pendente', valorAnterior: 'q0-c' });
      assert.equal(contarPendentes(seguraC, pendente, {}), 1);
      assert.equal(montarAplicacao('id', 'v1', seguraC, pendente, {}), undefined);
      assert.equal(leituraConfirmaSugestaoAnterior(seguraC[0], resolucao), true);
      assert.equal(rotuloDaPendencia(seguraC[0], resolucao), 'Revisar: decisão pendente');
    });
  }

  it('terceira leitura em branco igual a sugestao em branco segue pendente', () => {
    const brancoSugerido = aplicar(VAZIO, [sugestao('em_branco')]);
    const pendente = sairSemDecidir(brancoSugerido, DIVERGENTES['c) dupla']());
    const terceira = sugestao('em_branco');
    const resolucao = resolverQuestao(terceira, pendente, {});

    assert.deepEqual(resolucao, { origem: 'pendente', valorAnterior: null });
    assert.equal(leituraConfirmaSugestaoAnterior(terceira, resolucao), true);
    assert.equal(rotuloDaPendencia(terceira, resolucao), 'Revisar: decisão pendente');
  });

  it('mensagem da terceira leitura informa o valor repetido sem afirmar divergencia atual', () => {
    const mensagem = mensagemDeSugestaoRepetida('C');
    assert.match(mensagem, /^Esta leitura voltou a sugerir C/);
    assert.doesNotMatch(mensagem, /difere/);
  });

  it('terceira leitura com outro valor seguro continua informando a diferenca', () => {
    const pendente = sairSemDecidir(aposPrimeira(), DIVERGENTES['c) dupla']());
    const outra = sugestao('respondida', 0, 'q0-a', ['q0-a']);
    const resolucao = resolverQuestao(outra, pendente, {});

    assert.equal(leituraConfirmaSugestaoAnterior(outra, resolucao), false);
    assert.equal(rotuloDaPendencia(outra, resolucao), 'Revisar: difere da leitura anterior');
  });

  it('segunda leitura segura diferente continua informando a diferenca', () => {
    const outra = sugestao('respondida', 0, 'q0-a', ['q0-a']);
    const resolucao = resolverQuestao(outra, aposPrimeira(), {});
    assert.equal(rotuloDaPendencia(outra, resolucao), 'Revisar: difere da leitura anterior');
  });

  it('terceira leitura dupla ou incerta usa o rotulo do proprio estado', () => {
    const pendente = sairSemDecidir(aposPrimeira(), DIVERGENTES['c) dupla']());
    for (const nome of ['b) ambigua', 'c) dupla', 'd) nao localizada']) {
      const [atual] = DIVERGENTES[nome]();
      const resolucao = resolverQuestao(atual, pendente, {});
      assert.equal(resolucao.origem, 'pendente');
      assert.equal(leituraConfirmaSugestaoAnterior(atual, resolucao), false);
      assert.equal(rotuloDaPendencia(atual, resolucao), undefined);
    }
  });

  it('toque depois da terceira leitura igual resolve a pendencia', () => {
    const pendente = sairSemDecidir(aposPrimeira(), DIVERGENTES['c) dupla']());
    const tocada = registrarToque(pendente, 'q0', 'q0-c');
    const resolucao = resolverQuestao(seguraC[0], tocada, {});

    assert.deepEqual(resolucao, { origem: 'atual', valor: 'q0-c' });
    assert.equal(rotuloDaPendencia(seguraC[0], resolucao), undefined);
  });

  it('toque resolve a divergencia pendente como decisao manual', () => {
    const pendente = sairSemDecidir(aposPrimeira(), DIVERGENTES['c) dupla']());
    assert.deepEqual(registrarToque(pendente, 'q0', 'q0-c'), {
      marcadas: { q0: 'q0-c' },
      emBranco: [],
      sugeridasPelaLeitura: [],
      divergentes: {},
    });
  });

  it('professor pode decidir que a questao divergente fica em branco', () => {
    const pendente = sairSemDecidir(aposPrimeira(), DIVERGENTES['e) em branco']());
    assert.deepEqual(registrarBranco(pendente, 'q0'), {
      marcadas: {},
      emBranco: ['q0'],
      sugeridasPelaLeitura: [],
      divergentes: {},
    });
  });

  it('em branco depois de um toque remove a alternativa e vira decisao manual', () => {
    const tocada = registrarToque(aposPrimeira(), 'q0', 'q0-b');
    assert.deepEqual(registrarBranco(tocada, 'q0'), {
      marcadas: {},
      emBranco: ['q0'],
      sugeridasPelaLeitura: [],
      divergentes: {},
    });
  });

  it('nenhuma leitura futura sobrescreve o branco manual', () => {
    const branco = registrarBranco(registrarToque(VAZIO, 'q0', 'q0-b'), 'q0');
    for (const criar of [...Object.values(DIVERGENTES), () => seguraC]) {
      const sugestoes = criar();
      assert.deepEqual(resolverQuestao(sugestoes[0], branco, {}), {
        origem: 'atual',
        valor: null,
      });
      assert.equal(contarPendentes(sugestoes, branco, {}), 0);
      assert.deepEqual(sairSemDecidir(branco, sugestoes), branco);
      assert.deepEqual(aplicar(branco, sugestoes), branco);
    }
  });

  it('toque depois do branco manual volta a marcar a alternativa', () => {
    const branco = registrarBranco(registrarToque(VAZIO, 'q0', 'q0-b'), 'q0');
    assert.deepEqual(registrarToque(branco, 'q0', 'q0-d'), {
      marcadas: { q0: 'q0-d' },
      emBranco: [],
      sugeridasPelaLeitura: [],
      divergentes: {},
    });
  });

  it('selo mostra a decisao manual B quando a nova leitura ve em branco', () => {
    const manual = registrarToque(VAZIO, 'q0', 'q0-b');
    const leituraBranca = sugestao('em_branco');
    const resolucao = resolverQuestao(leituraBranca, manual, {});

    assert.deepEqual(resolucao, { origem: 'atual', valor: 'q0-b' });
    assert.equal(rotuloDaDecisaoManual(leituraBranca, resolucao, 'B'), 'Decisão manual: B');
    assert.deepEqual(aplicar(manual, [leituraBranca]), manual);
  });

  for (const nome of ['b) ambigua', 'c) dupla', 'd) nao localizada', 'outra letra segura']) {
    it(`selo mostra a decisao manual quando a nova leitura e ${nome}`, () => {
      const manual = registrarToque(VAZIO, 'q0', 'q0-b');
      const [atual] = DIVERGENTES[nome]();
      const resolucao = resolverQuestao(atual, manual, {});
      assert.equal(rotuloDaDecisaoManual(atual, resolucao, 'B'), 'Decisão manual: B');
    });
  }

  it('selo mostra o branco manual quando a nova leitura sugere uma letra', () => {
    const branco = registrarBranco(registrarToque(VAZIO, 'q0', 'q0-b'), 'q0');
    const resolucao = resolverQuestao(seguraC[0], branco, {});
    assert.equal(
      rotuloDaDecisaoManual(seguraC[0], resolucao, 'em branco'),
      'Decisão manual: em branco',
    );
  });

  it('selo mostra a escolha feita na revisao quando ela difere da leitura', () => {
    const leituraBranca = sugestao('em_branco');
    const resolucao = resolverQuestao(leituraBranca, VAZIO, { q0: 'q0-d' });
    assert.equal(rotuloDaDecisaoManual(leituraBranca, resolucao, 'D'), 'Decisão manual: D');
  });

  it('selo da leitura e mantido quando a decisao coincide ou nao ha decisao', () => {
    const manualC = registrarToque(VAZIO, 'q0', 'q0-c');
    const coincide = resolverQuestao(seguraC[0], manualC, {});
    assert.equal(rotuloDaDecisaoManual(seguraC[0], coincide, 'C'), undefined);

    const sugerida = resolverQuestao(seguraC[0], aposPrimeira(), {});
    assert.equal(rotuloDaDecisaoManual(seguraC[0], sugerida, 'C'), undefined);

    const nova = resolverQuestao(seguraC[0], VAZIO, {});
    assert.equal(rotuloDaDecisaoManual(seguraC[0], nova, 'C'), undefined);

    const [dupla] = DIVERGENTES['c) dupla']();
    const pendente = resolverQuestao(dupla, aposPrimeira(), {});
    assert.equal(rotuloDaDecisaoManual(dupla, pendente, 'sem resposta'), undefined);
  });

  it('revisao em nova leitura resolve a divergencia pendente', () => {
    const pendente = sairSemDecidir(aposPrimeira(), DIVERGENTES['c) dupla']());
    assert.deepEqual(aplicar(pendente, seguraC, { q0: 'q0-d' }), {
      marcadas: { q0: 'q0-d' },
      emBranco: [],
      sugeridasPelaLeitura: [],
      divergentes: {},
    });
  });

  it('voltar nao altera decisao manual nem leituras seguras iguais', () => {
    const manual = registrarToque(aposPrimeira(), 'q0', 'q0-b');
    assert.deepEqual(sairSemDecidir(manual, DIVERGENTES['c) dupla']()), manual);

    const sugerida = aposPrimeira();
    assert.deepEqual(sairSemDecidir(sugerida, seguraC), sugerida);

    const branco = aplicar(VAZIO, [sugestao('em_branco')]);
    assert.deepEqual(sairSemDecidir(branco, [sugestao('em_branco')]), branco);
  });

  it('ignora divergencia registrada para outra versao', () => {
    const atuais = aposPrimeira();
    const outra = { id: 'x', examVersionId: 'outra', valoresAnteriores: { q0: 'q0-c' } };
    assert.deepEqual(marcarDivergencias(atuais, outra, 'v1'), atuais);
  });

  it('escolha feita na revisao vira decisao manual para a leitura seguinte', () => {
    const revisada = aplicar(aposPrimeira(), DIVERGENTES['c) dupla'](), { q0: 'q0-d' });
    const proxima = DIVERGENTES['e) em branco']();
    assert.deepEqual(resolverQuestao(proxima[0], revisada, {}), { origem: 'atual', valor: 'q0-d' });
  });
});

describe('bloqueios da leitura', () => {
  const imagem = { largura: 1, altura: 1, dados: new Uint8Array(4) };

  it('sem fonte de imagem, bloqueia em vez de simular', async () => {
    assert.deepEqual(await executarLeitura(undefined, QUESTOES, nucleo), {
      ok: false,
      motivo: 'sem_fonte_de_imagem',
    });
  });

  it('captura com erro vira bloqueio', async () => {
    const r = await executarLeitura(() => Promise.reject(new Error('x')), QUESTOES, nucleo);
    assert.deepEqual(r, { ok: false, motivo: 'captura_falhou' });
  });

  it('imagem sem marcadores bloqueia', () => {
    assert.deepEqual(lerCartao(imagem, QUESTOES, nucleo), {
      ok: false,
      motivo: 'marcadores_nao_encontrados',
    });
  });

  it('prova maior que o cartao provisorio bloqueia', () => {
    const muitas = Array.from({ length: 21 }, (_, n) => questao(n));
    assert.deepEqual(lerCartao(imagem, muitas, nucleo), {
      ok: false,
      motivo: 'prova_incompativel',
    });
  });

  it('excecao no nucleo vira bloqueio', () => {
    const quebrado = {
      ...nucleo,
      detectar: () => {
        throw new Error('x');
      },
    };
    assert.deepEqual(lerCartao(imagem, QUESTOES, quebrado), {
      ok: false,
      motivo: 'falha_inesperada',
    });
  });
});

describe('integracao com o nucleo real em imagem sintetica', () => {
  it('le respondida, branco, dupla e parcial sem decidir os casos duvidosos', () => {
    const imagem = desenharCartao([
      [null, null, 'cheia', null, null],
      [null, null, null, null, null],
      ['cheia', null, null, 'cheia', null],
      [null, 'meia', null, null, null],
    ]);
    const r = lerCartao(imagem, QUESTOES, nucleo);
    assert.equal(r.ok, true);
    assert.deepEqual(
      r.sugestoes.map((s) => s.estado),
      ['respondida', 'em_branco', 'multipla', 'revisar'],
    );
    assert.equal(r.sugestoes[0].alternativaSugeridaId, 'q0-c');
    assert.equal(contarPendentes(r.sugestoes, VAZIO, {}), 2);
  });
});
