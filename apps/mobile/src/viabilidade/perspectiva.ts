import type { LayoutDeMarcadores, MarcadoresDaFolha, Ponto } from './marcadores';

/**
 * Viabilidade da issue #98: relaciona milimetros da folha com pixels da foto a partir dos
 * 4 marcadores, corrigindo rotacao, inclinacao e perspectiva.
 *
 * Codigo temporario, fora do fluxo de correcao. As medidas vem do layout recebido, porque
 * o layout definitivo do cartao ainda sera combinado na issue #92. A homografia modela um
 * plano: papel curvado e distorcao de lente nao sao corrigidos.
 */

export type MatrizHomografia = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type MotivoDaFalhaDePerspectiva =
  | 'layout_invalido'
  /** Coordenadas nao finitas, repetidas ou colineares. */
  | 'pontos_invalidos'
  /** Cantos cruzados, espelhados ou fora de um quadrilatero convexo. */
  | 'quadrilatero_invalido'
  | 'matriz_instavel'
  /** O tamanho previsto para um marcador difere do tamanho medido na foto. */
  | 'escala_inconsistente';

export type ResultadoDaPerspectiva =
  | {
      ok: true;
      /** Converte milimetros da folha em pixels da imagem. */
      folhaParaImagem: MatrizHomografia;
      /** Converte pixels da imagem em milimetros da folha. */
      imagemParaFolha: MatrizHomografia;
      /** Maior diferenca relativa entre o lado previsto e o medido de um marcador. */
      desvioMaximoDeEscala: number;
    }
  | { ok: false; motivo: MotivoDaFalhaDePerspectiva };

const DISTANCIA_MINIMA_PX = 1;
/** Area minima de um trio de pontos, em fracao do quadrado da maior distancia. */
const COLINEARIDADE_MINIMA = 1e-3;
const PIVO_MINIMO = 1e-10;
const ERRO_MAXIMO_DE_IDA_E_VOLTA_MM = 1e-6;
const DESVIO_MAXIMO_DE_ESCALA = 0.2;

export function aplicarHomografia(matriz: MatrizHomografia, ponto: Ponto): Ponto {
  const w = matriz[6] * ponto.x + matriz[7] * ponto.y + matriz[8];
  return {
    x: (matriz[0] * ponto.x + matriz[1] * ponto.y + matriz[2]) / w,
    y: (matriz[3] * ponto.x + matriz[4] * ponto.y + matriz[5]) / w,
  };
}

function layoutValido(layout: LayoutDeMarcadores): boolean {
  const { larguraDaFolhaMm, alturaDaFolhaMm, ladoDoMarcadorMm, margemMm } = layout;
  if (![larguraDaFolhaMm, alturaDaFolhaMm, ladoDoMarcadorMm, margemMm].every(Number.isFinite)) {
    return false;
  }
  const recuo = margemMm + ladoDoMarcadorMm / 2;
  return (
    ladoDoMarcadorMm > 0 &&
    margemMm >= 0 &&
    larguraDaFolhaMm - 2 * recuo > 0 &&
    alturaDaFolhaMm - 2 * recuo > 0
  );
}

/** Centros dos marcadores na folha, na ordem horaria a partir do superior esquerdo. */
function centrosNaFolha(layout: LayoutDeMarcadores): Ponto[] {
  const recuo = layout.margemMm + layout.ladoDoMarcadorMm / 2;
  const direita = layout.larguraDaFolhaMm - recuo;
  const base = layout.alturaDaFolhaMm - recuo;
  return [
    { x: recuo, y: recuo },
    { x: direita, y: recuo },
    { x: direita, y: base },
    { x: recuo, y: base },
  ];
}

function produtoVetorial(a: Ponto, b: Ponto, c: Ponto): number {
  return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
}

function pontosValidos(pontos: Ponto[]): boolean {
  if (!pontos.every((ponto) => Number.isFinite(ponto.x) && Number.isFinite(ponto.y))) {
    return false;
  }

  let maiorDistancia = 0;
  for (let i = 0; i < pontos.length; i += 1) {
    for (let j = i + 1; j < pontos.length; j += 1) {
      const d = Math.hypot(pontos[i].x - pontos[j].x, pontos[i].y - pontos[j].y);
      if (d < DISTANCIA_MINIMA_PX) return false;
      if (d > maiorDistancia) maiorDistancia = d;
    }
  }

  const areaMinima = COLINEARIDADE_MINIMA * maiorDistancia ** 2;
  for (let i = 0; i < pontos.length; i += 1) {
    for (let j = i + 1; j < pontos.length; j += 1) {
      for (let k = j + 1; k < pontos.length; k += 1) {
        if (Math.abs(produtoVetorial(pontos[i], pontos[j], pontos[k])) <= areaMinima) return false;
      }
    }
  }
  return true;
}

/** Em imagem, com y para baixo, a ordem horaria da folha da produto vetorial positivo. */
function quadrilateroValido(pontos: Ponto[]): boolean {
  return pontos.every(
    (ponto, i) =>
      produtoVetorial(ponto, pontos[(i + 1) % pontos.length], pontos[(i + 2) % pontos.length]) > 0,
  );
}

/** Centraliza os pontos e padroniza a escala, para o sistema linear ficar bem condicionado. */
function matrizesDeNormalizacao(pontos: Ponto[]) {
  const cx = pontos.reduce((soma, ponto) => soma + ponto.x, 0) / pontos.length;
  const cy = pontos.reduce((soma, ponto) => soma + ponto.y, 0) / pontos.length;
  const distanciaMedia =
    pontos.reduce((soma, ponto) => soma + Math.hypot(ponto.x - cx, ponto.y - cy), 0) /
    pontos.length;
  const s = Math.SQRT2 / distanciaMedia;
  const direta: MatrizHomografia = [s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1];
  const inversa: MatrizHomografia = [1 / s, 0, cx, 0, 1 / s, cy, 0, 0, 1];
  return { direta, inversa };
}

function multiplicar(a: MatrizHomografia, b: MatrizHomografia): MatrizHomografia {
  const saida = new Array<number>(9).fill(0);
  for (let linha = 0; linha < 3; linha += 1) {
    for (let coluna = 0; coluna < 3; coluna += 1) {
      for (let k = 0; k < 3; k += 1) {
        saida[linha * 3 + coluna] += a[linha * 3 + k] * b[k * 3 + coluna];
      }
    }
  }
  return saida as unknown as MatrizHomografia;
}

function comUltimoTermoUnitario(m: MatrizHomografia): MatrizHomografia | undefined {
  if (!m.every(Number.isFinite) || Math.abs(m[8]) < PIVO_MINIMO) return undefined;
  return m.map((valor) => valor / m[8]) as unknown as MatrizHomografia;
}

function inverter(m: MatrizHomografia): MatrizHomografia | undefined {
  const [a, b, c, d, e, f, g, h, i] = m;
  const adjunta: MatrizHomografia = [
    e * i - f * h,
    c * h - b * i,
    b * f - c * e,
    f * g - d * i,
    a * i - c * g,
    c * d - a * f,
    d * h - e * g,
    b * g - a * h,
    a * e - b * d,
  ];
  const determinante = a * adjunta[0] + b * adjunta[3] + c * adjunta[6];
  if (!Number.isFinite(determinante) || determinante === 0) return undefined;
  return comUltimoTermoUnitario(adjunta);
}

/** Eliminacao de Gauss com pivoteamento parcial. */
function resolverSistema(coeficientes: number[][], termos: number[]): number[] | undefined {
  const n = termos.length;
  const m = coeficientes.map((linha, i) => [...linha, termos[i]]);

  for (let coluna = 0; coluna < n; coluna += 1) {
    let pivo = coluna;
    for (let linha = coluna + 1; linha < n; linha += 1) {
      if (Math.abs(m[linha][coluna]) > Math.abs(m[pivo][coluna])) pivo = linha;
    }
    if (Math.abs(m[pivo][coluna]) < PIVO_MINIMO) return undefined;
    [m[coluna], m[pivo]] = [m[pivo], m[coluna]];

    for (let linha = coluna + 1; linha < n; linha += 1) {
      const fator = m[linha][coluna] / m[coluna][coluna];
      for (let k = coluna; k <= n; k += 1) m[linha][k] -= fator * m[coluna][k];
    }
  }

  const solucao = new Array<number>(n).fill(0);
  for (let linha = n - 1; linha >= 0; linha -= 1) {
    let soma = m[linha][n];
    for (let k = linha + 1; k < n; k += 1) soma -= m[linha][k] * solucao[k];
    solucao[linha] = soma / m[linha][linha];
  }
  return solucao;
}

function estimarHomografia(origem: Ponto[], destino: Ponto[]): MatrizHomografia | undefined {
  const normalOrigem = matrizesDeNormalizacao(origem);
  const normalDestino = matrizesDeNormalizacao(destino);
  const coeficientes: number[][] = [];
  const termos: number[] = [];

  for (let i = 0; i < origem.length; i += 1) {
    const p = aplicarHomografia(normalOrigem.direta, origem[i]);
    const q = aplicarHomografia(normalDestino.direta, destino[i]);
    coeficientes.push([p.x, p.y, 1, 0, 0, 0, -q.x * p.x, -q.x * p.y]);
    termos.push(q.x);
    coeficientes.push([0, 0, 0, p.x, p.y, 1, -q.y * p.x, -q.y * p.y]);
    termos.push(q.y);
  }

  const solucao = resolverSistema(coeficientes, termos);
  if (!solucao) return undefined;
  const normalizada = [...solucao, 1] as unknown as MatrizHomografia;
  return comUltimoTermoUnitario(
    multiplicar(multiplicar(normalDestino.inversa, normalizada), normalOrigem.direta),
  );
}

/** Quantos pixels da imagem correspondem a 1 mm da folha em torno do ponto. */
function escalaLocal(m: MatrizHomografia, ponto: Ponto): number {
  const w = m[6] * ponto.x + m[7] * ponto.y + m[8];
  const u = (m[0] * ponto.x + m[1] * ponto.y + m[2]) / w;
  const v = (m[3] * ponto.x + m[4] * ponto.y + m[5]) / w;
  const dux = (m[0] - u * m[6]) / w;
  const duy = (m[1] - u * m[7]) / w;
  const dvx = (m[3] - v * m[6]) / w;
  const dvy = (m[4] - v * m[7]) / w;
  return Math.sqrt(Math.abs(dux * dvy - duy * dvx));
}

/** Calcula a homografia. Sem resultado confiavel, devolve o motivo em vez de uma matriz. */
export function calcularPerspectiva(
  marcadores: MarcadoresDaFolha,
  layout: LayoutDeMarcadores,
): ResultadoDaPerspectiva {
  if (!layoutValido(layout)) return { ok: false, motivo: 'layout_invalido' };

  const detectados = [
    marcadores.superiorEsquerdo,
    marcadores.superiorDireito,
    marcadores.inferiorDireito,
    marcadores.inferiorEsquerdo,
  ];
  const naImagem = detectados.map((marcador) => marcador.centro);
  if (!pontosValidos(naImagem)) return { ok: false, motivo: 'pontos_invalidos' };
  if (!detectados.every((item) => Number.isFinite(item.ladoPx) && item.ladoPx > 0)) {
    return { ok: false, motivo: 'pontos_invalidos' };
  }
  if (!quadrilateroValido(naImagem)) return { ok: false, motivo: 'quadrilatero_invalido' };

  const naFolha = centrosNaFolha(layout);
  const folhaParaImagem = estimarHomografia(naFolha, naImagem);
  if (!folhaParaImagem) return { ok: false, motivo: 'matriz_instavel' };
  const imagemParaFolha = inverter(folhaParaImagem);
  if (!imagemParaFolha) return { ok: false, motivo: 'matriz_instavel' };

  // O plano da folha inteira precisa ficar do mesmo lado da camera.
  const { larguraDaFolhaMm: largura, alturaDaFolhaMm: altura } = layout;
  const cantosDaFolha = [
    { x: 0, y: 0 },
    { x: largura, y: 0 },
    { x: largura, y: altura },
    { x: 0, y: altura },
  ];
  const planoValido = cantosDaFolha.every(
    (canto) => folhaParaImagem[6] * canto.x + folhaParaImagem[7] * canto.y + folhaParaImagem[8] > 0,
  );
  if (!planoValido) return { ok: false, motivo: 'matriz_instavel' };

  for (let i = 0; i < naFolha.length; i += 1) {
    const volta = aplicarHomografia(
      imagemParaFolha,
      aplicarHomografia(folhaParaImagem, naFolha[i]),
    );
    if (
      Math.hypot(volta.x - naFolha[i].x, volta.y - naFolha[i].y) > ERRO_MAXIMO_DE_IDA_E_VOLTA_MM
    ) {
      return { ok: false, motivo: 'matriz_instavel' };
    }
  }

  // Quatro pontos sempre se encaixam: o tamanho medido e a checagem independente.
  let desvioMaximoDeEscala = 0;
  for (let i = 0; i < naFolha.length; i += 1) {
    const previsto = escalaLocal(folhaParaImagem, naFolha[i]) * layout.ladoDoMarcadorMm;
    const desvio = Math.abs(detectados[i].ladoPx / previsto - 1);
    if (desvio > desvioMaximoDeEscala) desvioMaximoDeEscala = desvio;
  }
  if (desvioMaximoDeEscala > DESVIO_MAXIMO_DE_ESCALA) {
    return { ok: false, motivo: 'escala_inconsistente' };
  }

  return { ok: true, folhaParaImagem, imagemParaFolha, desvioMaximoDeEscala };
}
