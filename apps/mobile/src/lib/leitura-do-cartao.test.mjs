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
  lerCartao,
  montarAplicacao,
  resolverQuestao,
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
const VAZIO = { marcadas: {}, emBranco: [] };

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
      { marcadas: { q0: 'q0-a' }, emBranco: [] },
      {},
    );
    assert.deepEqual(r, { origem: 'atual', valor: 'q0-a' });
  });

  it('toque na revisao vence a marcacao atual', () => {
    const r = resolverQuestao(
      sugestao('respondida', 0, 'q0-c'),
      { marcadas: { q0: 'q0-a' }, emBranco: [] },
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
    const atuais = { marcadas: { q0: 'q0-a' }, emBranco: [] };
    const r = aplicar(atuais, [sugestao('respondida', 0, 'q0-c')]);
    assert.deepEqual(r.marcadas, { q0: 'q0-a' });
    assert.deepEqual(atuais, { marcadas: { q0: 'q0-a' }, emBranco: [] });
  });

  it('sugestao adulterada da camera nao sobrescreve marcacao manual', () => {
    const atuais = { marcadas: { q0: 'q0-a' }, emBranco: [] };
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
    const r1 = aplicar({ marcadas: { q0: 'q0-a' }, emBranco: [] }, [sugestao('revisar')], {
      q0: null,
    });
    assert.deepEqual(r1, { marcadas: {}, emBranco: ['q0'] });
    const r2 = aplicar(r1, [sugestao('revisar')], { q0: 'q0-b' });
    assert.deepEqual(r2, { marcadas: { q0: 'q0-b' }, emBranco: [] });
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
