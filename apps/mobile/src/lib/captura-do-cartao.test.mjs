import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { describe, it } from 'node:test';
import jpeg from 'jpeg-js';
import { nucleoDeLeitura } from '../viabilidade/nucleo-de-leitura.ts';
import { criarLayoutProvisorioDeBolhas } from '../viabilidade/layout-provisorio.ts';
import { escolherTamanhoDaFoto } from '../viabilidade/obter-pixels.ts';
import {
  areaNaFotoExibida,
  descartarFoto,
  lerOrientacaoExif,
  prepararFoto,
  segmentosDaArea,
} from './captura-do-cartao.ts';
import { contarPendentes, executarLeitura, montarAplicacao } from './leitura-do-cartao.ts';

const PX_POR_MM = 5;
const LARGURA = 210 * PX_POR_MM;
const ALTURA = 297 * PX_POR_MM;

// Identificadores neutros: nenhum dado de aluno ou de prova real.
const questao = (n) => ({
  questionId: `q${n}`,
  alternativas: ['a', 'b', 'c', 'd'].map((sufixo, i) => ({
    id: `q${n}-${sufixo}`,
    letra: 'ABCD'[i],
  })),
});
const QUESTOES = [questao(0), questao(1), questao(2)];

/** Cartao sintetico em pe: C na 1a questao, branco na 2a e dupla na 3a. */
function desenharCartao() {
  const dados = new Uint8Array(LARGURA * ALTURA * 4).fill(235);
  for (let i = 3; i < dados.length; i += 4) dados[i] = 255;
  const pintar = (x, y) => {
    const i = (y * LARGURA + x) * 4;
    dados[i] = dados[i + 1] = dados[i + 2] = 25;
  };
  const quadrado = (cx, cy, vazado = false) => {
    for (let y = (cy - 5) * PX_POR_MM; y < (cy + 5) * PX_POR_MM; y += 1) {
      for (let x = (cx - 5) * PX_POR_MM; x < (cx + 5) * PX_POR_MM; x += 1) {
        const noFuro = Math.abs(x / PX_POR_MM - cx) < 2 && Math.abs(y / PX_POR_MM - cy) < 2;
        if (!(vazado && noFuro)) pintar(x, y);
      }
    }
  };
  quadrado(15, 15, true);
  quadrado(195, 15);
  quadrado(195, 282);
  quadrado(15, 282);

  const cheias = [[2], [], [0, 1]];
  criarLayoutProvisorioDeBolhas([4, 4, 4]).questoes.forEach(({ bolhas }, q) => {
    for (const { indiceDaOpcao, centroMm } of bolhas) {
      const cheia = cheias[q].includes(indiceDaOpcao);
      for (let y = (centroMm.y - 3) * PX_POR_MM; y <= (centroMm.y + 3) * PX_POR_MM; y += 1) {
        for (let x = (centroMm.x - 3) * PX_POR_MM; x <= (centroMm.x + 3) * PX_POR_MM; x += 1) {
          const d = Math.hypot(x / PX_POR_MM - centroMm.x, y / PX_POR_MM - centroMm.y);
          if (d <= 3 && (d >= 2.75 || cheia)) pintar(x, y);
        }
      }
    }
  });
  return { width: LARGURA, height: ALTURA, data: dados };
}

/** Grava os pixels girados 90 graus, como um sensor que depende do EXIF 6 para ficar em pe. */
function girarParaExif6({ width, height, data }) {
  const saida = new Uint8Array(width * height * 4);
  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < height; x += 1) {
      const origem = (x * width + (width - 1 - y)) * 4;
      const destino = (y * height + x) * 4;
      for (let c = 0; c < 4; c += 1) saida[destino + c] = data[origem + c];
    }
  }
  return { width: height, height: width, data: saida };
}

function segmentoExif(orientacao, littleEndian = true) {
  const tiff = Buffer.alloc(26);
  const u16 = (v, p) => (littleEndian ? tiff.writeUInt16LE(v, p) : tiff.writeUInt16BE(v, p));
  const u32 = (v, p) => (littleEndian ? tiff.writeUInt32LE(v, p) : tiff.writeUInt32BE(v, p));
  tiff.write(littleEndian ? 'II' : 'MM', 0, 'latin1');
  u16(42, 2);
  u32(8, 4);
  u16(1, 8);
  u16(0x0112, 10);
  u16(3, 12);
  u32(1, 14);
  u16(orientacao, 18);
  const conteudo = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const cabecalho = Buffer.from([0xff, 0xe1, 0, 0]);
  cabecalho.writeUInt16BE(conteudo.length + 2, 2);
  return Buffer.concat([cabecalho, conteudo]);
}

function comExif(jpegBytes, orientacao, littleEndian) {
  const bytes = Buffer.from(jpegBytes);
  return Buffer.concat([
    bytes.subarray(0, 2),
    segmentoExif(orientacao, littleEndian),
    bytes.subarray(2),
  ]);
}

const jpegDoCartao = (quadro = desenharCartao()) => jpeg.encode(quadro, 92).data;
const JPEG_MINIMO = jpeg.encode(
  { width: 2, height: 2, data: new Uint8Array(16).fill(200) },
  90,
).data;

describe('orientacao EXIF', () => {
  for (const orientacao of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`le a orientacao ${orientacao} em little e big endian`, () => {
      assert.equal(lerOrientacaoExif(comExif(JPEG_MINIMO, orientacao, true)), orientacao);
      assert.equal(lerOrientacaoExif(comExif(JPEG_MINIMO, orientacao, false)), orientacao);
    });
  }

  it('JPEG sem EXIF fica como gravado', () => {
    assert.equal(lerOrientacaoExif(JPEG_MINIMO), 1);
  });

  for (const [nome, bytes] of [
    ['vazio', new Uint8Array()],
    ['nao JPEG', new Uint8Array([1, 2, 3, 4, 5, 6])],
    ['valor fora do intervalo', comExif(JPEG_MINIMO, 9)],
    ['segmento truncado', comExif(JPEG_MINIMO, 6).subarray(0, 12)],
  ]) {
    it(`dado invalido (${nome}) fica como gravado`, () => {
      assert.equal(lerOrientacaoExif(bytes), 1);
    });
  }
});

describe('area na foto exibida', () => {
  const area = {
    largura: 100,
    altura: 50,
    cantos: [
      { x: 10, y: 5 },
      { x: 90, y: 5 },
      { x: 90, y: 45 },
      { x: 10, y: 45 },
    ],
  };

  for (const [orientacao, largura, altura, primeiro] of [
    [1, 100, 50, { x: 10, y: 5 }],
    [2, 100, 50, { x: 90, y: 5 }],
    [3, 100, 50, { x: 90, y: 45 }],
    [4, 100, 50, { x: 10, y: 45 }],
    [5, 50, 100, { x: 5, y: 10 }],
    [6, 50, 100, { x: 45, y: 10 }],
    [7, 50, 100, { x: 45, y: 90 }],
    [8, 50, 100, { x: 5, y: 90 }],
  ]) {
    it(`converte os pontos na orientacao ${orientacao}`, () => {
      const exibida = areaNaFotoExibida(area, orientacao);
      assert.equal(exibida.largura, largura);
      assert.equal(exibida.altura, altura);
      assert.deepEqual(exibida.cantos[0], primeiro);
    });
  }

  it('calcula os quatro lados na escala da moldura', () => {
    const segmentos = segmentosDaArea(area.cantos, 2);
    assert.equal(segmentos.length, 4);
    assert.deepEqual(segmentos[0], { x: 100, y: 10, comprimento: 160, anguloRad: 0 });
    assert.equal(segmentos[1].comprimento, 80);
    assert.equal(segmentos[1].anguloRad, Math.PI / 2);
  });
});

describe('foto ate a leitura', () => {
  const ler = (bytes) => {
    const base64 = Buffer.from(bytes).toString('base64');
    let foto;
    return executarLeitura(
      async () => {
        foto = prepararFoto(base64);
        return foto.imagem;
      },
      QUESTOES,
      nucleoDeLeitura,
    ).then((resultado) => ({ resultado, foto }));
  };

  it('le o JPEG capturado e devolve os estados e a area', async () => {
    const { resultado, foto } = await ler(jpegDoCartao());

    assert.equal(resultado.ok, true);
    assert.equal(foto.orientacao, 1);
    assert.deepEqual(
      resultado.sugestoes.map((s) => s.estado),
      ['respondida', 'em_branco', 'multipla'],
    );
    assert.equal(resultado.sugestoes[0].alternativaSugeridaId, 'q0-c');
    assert.equal(resultado.sugestoes[2].alternativaSugeridaId, undefined);

    const esperados = [
      [15, 15],
      [195, 15],
      [195, 282],
      [15, 282],
    ];
    resultado.areaDetectada.cantos.forEach((canto, i) => {
      assert.ok(Math.abs(canto.x - esperados[i][0] * PX_POR_MM) < 4);
      assert.ok(Math.abs(canto.y - esperados[i][1] * PX_POR_MM) < 4);
    });
  });

  it('foto gravada girada com EXIF 6 e lida e a area aparece em pe', async () => {
    const { resultado, foto } = await ler(
      comExif(jpegDoCartao(girarParaExif6(desenharCartao())), 6),
    );

    assert.equal(resultado.ok, true);
    assert.equal(foto.orientacao, 6);
    assert.equal(foto.imagem.largura, ALTURA);
    assert.deepEqual(
      resultado.sugestoes.map((s) => s.estado),
      ['respondida', 'em_branco', 'multipla'],
    );

    const exibida = areaNaFotoExibida(resultado.areaDetectada, foto.orientacao);
    assert.equal(exibida.largura, LARGURA);
    assert.equal(exibida.altura, ALTURA);
    assert.ok(Math.abs(exibida.cantos[0].x - 15 * PX_POR_MM) < 4);
    assert.ok(Math.abs(exibida.cantos[0].y - 15 * PX_POR_MM) < 4);
    assert.ok(Math.abs(exibida.cantos[2].x - 195 * PX_POR_MM) < 4);
    assert.ok(Math.abs(exibida.cantos[2].y - 282 * PX_POR_MM) < 4);
  });

  it('foto sem marcadores bloqueia a leitura', async () => {
    const vazia = {
      width: 400,
      height: 600,
      data: new Uint8Array(400 * 600 * 4).fill(235),
    };
    const { resultado } = await ler(jpeg.encode(vazia, 90).data);
    assert.deepEqual(resultado, { ok: false, motivo: 'marcadores_nao_encontrados' });
  });

  for (const [nome, base64] of [
    ['vazia', ''],
    ['que nao e JPEG', Buffer.from('nao e uma foto').toString('base64')],
  ]) {
    it(`foto ${nome} vira falha de captura, sem resposta`, async () => {
      const resultado = await executarLeitura(
        async () => prepararFoto(base64).imagem,
        QUESTOES,
        nucleoDeLeitura,
      );
      assert.deepEqual(resultado, { ok: false, motivo: 'captura_falhou' });
    });
  }
});

describe('marca fora das alternativas da questao', () => {
  const VAZIO = { marcadas: {}, emBranco: [], sugeridasPelaLeitura: [], divergentes: {} };
  const LETRAS = 'abcde';
  const questaoCom = (opcoes) => ({
    questionId: 'q',
    alternativas: Array.from({ length: opcoes }, (_, i) => ({
      id: `q-${LETRAS[i]}`,
      letra: LETRAS[i].toUpperCase(),
    })),
  });

  /** Foto de uma questao, com `impressas` bolhas desenhadas e as `marcadas` preenchidas. */
  function fotoDaQuestao(marcadas, impressas = 5) {
    const dados = new Uint8Array(LARGURA * ALTURA * 4).fill(235);
    const pintar = (x, y) => {
      const i = (y * LARGURA + x) * 4;
      dados[i] = dados[i + 1] = dados[i + 2] = 25;
    };
    const quadrado = (cx, cy, vazado = false) => {
      for (let y = (cy - 5) * PX_POR_MM; y < (cy + 5) * PX_POR_MM; y += 1) {
        for (let x = (cx - 5) * PX_POR_MM; x < (cx + 5) * PX_POR_MM; x += 1) {
          const noFuro = Math.abs(x / PX_POR_MM - cx) < 2 && Math.abs(y / PX_POR_MM - cy) < 2;
          if (!(vazado && noFuro)) pintar(x, y);
        }
      }
    };
    quadrado(15, 15, true);
    quadrado(195, 15);
    quadrado(195, 282);
    quadrado(15, 282);
    for (const { indiceDaOpcao, centroMm } of criarLayoutProvisorioDeBolhas([5]).questoes[0]
      .bolhas) {
      if (indiceDaOpcao >= impressas) continue;
      const cheia = marcadas.includes(indiceDaOpcao);
      for (let y = (centroMm.y - 3) * PX_POR_MM; y <= (centroMm.y + 3) * PX_POR_MM; y += 1) {
        for (let x = (centroMm.x - 3) * PX_POR_MM; x <= (centroMm.x + 3) * PX_POR_MM; x += 1) {
          const d = Math.hypot(x / PX_POR_MM - centroMm.x, y / PX_POR_MM - centroMm.y);
          if (d <= 3 && (d >= 2.75 || cheia)) pintar(x, y);
        }
      }
    }
    const bytes = jpeg.encode({ width: LARGURA, height: ALTURA, data: dados }, 92).data;
    return Buffer.from(bytes).toString('base64');
  }

  const lerQuestao = async (marcadas, opcoes, impressas) => {
    const base64 = fotoDaQuestao(marcadas, impressas);
    const resultado = await executarLeitura(
      async () => prepararFoto(base64).imagem,
      [questaoCom(opcoes)],
      nucleoDeLeitura,
    );
    assert.equal(resultado.ok, true);
    return resultado.sugestoes;
  };

  for (const [nome, marcadas] of [
    ['B + E', [1, 4]],
    ['somente E', [4]],
  ]) {
    it(`${nome} em questao de 4 alternativas exige revisao manual`, async () => {
      const sugestoes = await lerQuestao(marcadas, 4);

      assert.equal(sugestoes[0].estado, 'revisar');
      assert.equal(sugestoes[0].marcaExcedente, true);
      assert.equal(sugestoes[0].alternativaSugeridaId, undefined);
      assert.equal(contarPendentes(sugestoes, VAZIO, {}), 1);
      assert.equal(montarAplicacao('id', 'v', sugestoes, VAZIO, {}), undefined);
    });
  }

  it('B + C em questao de 4 alternativas continua como dupla marcacao', async () => {
    const [sugestao] = await lerQuestao([1, 2], 4);
    assert.equal(sugestao.estado, 'multipla');
    assert.equal(sugestao.marcaExcedente, undefined);
    assert.deepEqual(sugestao.alternativasDetectadasIds, ['q-b', 'q-c']);
  });

  it('marca valida unica mantem a resposta', async () => {
    const [sugestao] = await lerQuestao([2], 4);
    assert.equal(sugestao.estado, 'respondida');
    assert.equal(sugestao.alternativaSugeridaId, 'q-c');
    assert.equal(sugestao.marcaExcedente, undefined);
  });

  it('cartao impresso com 4 bolhas le a resposta normalmente', async () => {
    const [sugestao] = await lerQuestao([3], 4, 4);
    assert.equal(sugestao.estado, 'respondida');
    assert.equal(sugestao.alternativaSugeridaId, 'q-d');
  });

  it('cartao impresso com 4 bolhas sem marca continua em branco', async () => {
    const [sugestao] = await lerQuestao([], 4, 4);
    assert.equal(sugestao.estado, 'em_branco');
  });

  it('questao de 2 alternativas com marca na 3a bolha exige revisao', async () => {
    const [sugestao] = await lerQuestao([2], 2);
    assert.equal(sugestao.estado, 'revisar');
    assert.equal(sugestao.marcaExcedente, true);
  });

  it('questao de 5 alternativas aceita E como resposta', async () => {
    const [sugestao] = await lerQuestao([4], 5);
    assert.equal(sugestao.estado, 'respondida');
    assert.equal(sugestao.alternativaSugeridaId, 'q-e');
    assert.equal(sugestao.marcaExcedente, undefined);
  });

  it('questao de 5 alternativas com B + E continua como dupla marcacao', async () => {
    const [sugestao] = await lerQuestao([1, 4], 5);
    assert.equal(sugestao.estado, 'multipla');
    assert.equal(sugestao.marcaExcedente, undefined);
  });

  it('o layout le sempre as 5 posicoes e recusa mais de 5 alternativas', () => {
    const layout = criarLayoutProvisorioDeBolhas([2, 4, 5]);
    assert.deepEqual(
      layout.questoes.map((item) => item.bolhas.length),
      [5, 5, 5],
    );
    assert.equal(criarLayoutProvisorioDeBolhas([6]), undefined);
  });
});

describe('descarte da foto temporaria', () => {
  const URI = 'file:///cache/Camera/foto.jpg';

  it('apaga o arquivo da camera', async () => {
    const apagados = [];
    const resultado = await descartarFoto(URI, async (uri) => {
      apagados.push(uri);
    });
    assert.equal(resultado, 'removida');
    assert.deepEqual(apagados, [URI]);
  });

  it('falha ao apagar nao derruba e fica registrada', async () => {
    const resultado = await descartarFoto(URI, async () => {
      throw new Error('sem acesso');
    });
    assert.equal(resultado, 'falhou');
  });

  for (const [nome, uri] of [
    ['ausente', undefined],
    ['vazio', ''],
    ['em base64, como na web', 'data:image/jpeg;base64,AAAA'],
  ]) {
    it(`uri ${nome} nao tenta apagar nada`, async () => {
      let chamadas = 0;
      const resultado = await descartarFoto(uri, async () => {
        chamadas += 1;
      });
      assert.equal(resultado, 'sem_arquivo');
      assert.equal(chamadas, 0);
    });
  }

  it('a leitura continua depois de uma falha ao apagar', async () => {
    const base64 = Buffer.from(jpegDoCartao()).toString('base64');
    const descarte = await descartarFoto(URI, async () => {
      throw new Error('sem acesso');
    });
    const resultado = await executarLeitura(
      async () => prepararFoto(base64).imagem,
      QUESTOES,
      nucleoDeLeitura,
    );
    assert.equal(descarte, 'falhou');
    assert.equal(resultado.ok, true);
  });
});

describe('escolha da resolucao da foto', () => {
  it('usa a menor resolucao com lado maior suficiente', () => {
    assert.equal(escolherTamanhoDaFoto(['640x480', '1920x1080', '4032x3024']), '1920x1080');
  });

  it('sem opcao suficiente, usa a maior disponivel', () => {
    assert.equal(escolherTamanhoDaFoto(['320x240', '1280x720']), '1280x720');
  });

  it('sem tamanho reconhecido, usa o padrao do aparelho', () => {
    assert.equal(escolherTamanhoDaFoto(['Photo', 'High']), undefined);
  });
});
