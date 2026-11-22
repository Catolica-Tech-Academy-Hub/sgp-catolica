/**
 * Viabilidade da issue #98: localiza os 4 marcadores de referencia do cartao-resposta e
 * descobre a orientacao da folha na imagem.
 *
 * Codigo temporario, fora do fluxo de correcao. As medidas abaixo sao provisorias ate o
 * layout do cartao ser combinado na issue #92, por isso entram como parametro.
 */

export interface ImagemRgba {
  largura: number;
  altura: number;
  dados: ArrayLike<number>;
}

/** Medidas da folha e dos marcadores, em milimetros. */
export interface LayoutDeMarcadores {
  larguraDaFolhaMm: number;
  alturaDaFolhaMm: number;
  ladoDoMarcadorMm: number;
  /** Distancia entre a borda da folha e a borda do marcador. */
  margemMm: number;
  /** Lado do furo central do marcador superior esquerdo, que define a orientacao. */
  ladoDoFuroMm: number;
}

/** A4 com tres marcadores solidos e o superior esquerdo vazado. */
export const LAYOUT_PROVISORIO: LayoutDeMarcadores = {
  larguraDaFolhaMm: 210,
  alturaDaFolhaMm: 297,
  ladoDoMarcadorMm: 10,
  margemMm: 10,
  ladoDoFuroMm: 4,
};

export interface Ponto {
  x: number;
  y: number;
}

export interface MarcadorDetectado {
  /** Centro do marcador, em pixels da imagem original. */
  centro: Ponto;
  /** Lado aproximado do marcador, em pixels da imagem original. */
  ladoPx: number;
  vazado: boolean;
}

/** Cantos sempre em relacao a folha, nao a imagem. */
export interface MarcadoresDaFolha {
  superiorEsquerdo: MarcadorDetectado;
  superiorDireito: MarcadorDetectado;
  inferiorDireito: MarcadorDetectado;
  inferiorEsquerdo: MarcadorDetectado;
}

/** Rotacao da folha na imagem, em sentido horario. */
export type OrientacaoDaFolha = 0 | 90 | 180 | 270;

export type MotivoDaFalha =
  | 'imagem_invalida'
  | 'sem_marcador_vazado'
  | 'marcadores_insuficientes'
  | 'candidatos_demais'
  | 'geometria_invalida'
  | 'leitura_ambigua';

export type ResultadoDaDeteccao =
  | {
      ok: true;
      orientacao: OrientacaoDaFolha;
      /** Diferenca, em graus, entre a rotacao medida e a orientacao. */
      inclinacaoGraus: number;
      marcadores: MarcadoresDaFolha;
      totalDeCandidatos: number;
      tempoMs: number;
    }
  | { ok: false; motivo: MotivoDaFalha; totalDeCandidatos: number; tempoMs: number };

/** Acima disso a imagem e reduzida, para a analise caber no JavaScript do aparelho. */
const MAIOR_LADO_DE_TRABALHO = 1200;
/** Pixel escuro e o que fica abaixo desta fracao da media da vizinhanca. */
const LIMIAR_ADAPTATIVO = 0.75;
const FRACAO_DA_JANELA = 1 / 6;

const LADO_MINIMO_PX = 8;
const LADO_MAXIMO_RELATIVO = 0.2;
const OCUPACAO_MINIMA_DA_CAIXA = 0.3;
const ASPECTO_MAXIMO_DA_CAIXA = 2;
/** Separa quadrado de circulo: um circulo ocupa cerca de 64% nesta medida. */
const QUADRATURA_MINIMA = 0.82;
const ANISOTROPIA_MAXIMA = 0.25;
const DESVIO_MAXIMO_DO_FURO = 0.15;

const LIMITE_DE_CANDIDATOS = 40;
const RAZAO_MAXIMA_ENTRE_MARCADORES = 1.6;
const RAZAO_MAXIMA_ENTRE_LADOS_OPOSTOS = 1 / 0.7;
const RAZAO_MAXIMA_DE_ASPECTO = 1.3;
const DESVIO_MAXIMO_DE_ANGULO_GRAUS = 25;
/** Duas combinacoes com pontuacao tao proxima nao sao decididas por palpite. */
const MARGEM_DE_AMBIGUIDADE = 0.03;

interface Reduzida {
  largura: number;
  altura: number;
  cinza: Uint8Array;
}

interface Componente {
  rotulo: number;
  area: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface Candidato {
  centro: Ponto;
  lado: number;
  vazado: boolean;
}

interface Cantos {
  superiorEsquerdo: Candidato;
  superiorDireito: Candidato;
  inferiorDireito: Candidato;
  inferiorEsquerdo: Candidato;
}

function paraCinzaReduzido(imagem: ImagemRgba, fator: number): Reduzida {
  const largura = Math.floor(imagem.largura / fator);
  const altura = Math.floor(imagem.altura / fator);
  const cinza = new Uint8Array(largura * altura);
  const { dados } = imagem;
  const pixelsPorBloco = fator * fator;

  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      let soma = 0;
      for (let by = y * fator; by < (y + 1) * fator; by += 1) {
        for (let bx = x * fator; bx < (x + 1) * fator; bx += 1) {
          const i = (by * imagem.largura + bx) * 4;
          soma += 0.299 * dados[i] + 0.587 * dados[i + 1] + 0.114 * dados[i + 2];
        }
      }
      cinza[y * largura + x] = Math.round(soma / pixelsPorBloco);
    }
  }
  return { largura, altura, cinza };
}

/** Limiar adaptativo por imagem integral: tolera sombra e iluminacao desigual. */
function binarizar({ largura, altura, cinza }: Reduzida): Uint8Array {
  const passo = largura + 1;
  const integral = new Uint32Array(passo * (altura + 1));
  for (let y = 0; y < altura; y += 1) {
    let somaDaLinha = 0;
    for (let x = 0; x < largura; x += 1) {
      somaDaLinha += cinza[y * largura + x];
      integral[(y + 1) * passo + x + 1] = integral[y * passo + x + 1] + somaDaLinha;
    }
  }

  const raio = Math.max(7, Math.floor((Math.max(largura, altura) * FRACAO_DA_JANELA) / 2));
  const escuro = new Uint8Array(largura * altura);
  for (let y = 0; y < altura; y += 1) {
    const y0 = Math.max(0, y - raio);
    const y1 = Math.min(altura, y + raio + 1);
    for (let x = 0; x < largura; x += 1) {
      const x0 = Math.max(0, x - raio);
      const x1 = Math.min(largura, x + raio + 1);
      const soma =
        integral[y1 * passo + x1] -
        integral[y0 * passo + x1] -
        integral[y1 * passo + x0] +
        integral[y0 * passo + x0];
      const area = (x1 - x0) * (y1 - y0);
      if (cinza[y * largura + x] * area < soma * LIMIAR_ADAPTATIVO) {
        escuro[y * largura + x] = 1;
      }
    }
  }
  return escuro;
}

function encontrarComponentes(escuro: Uint8Array, largura: number, altura: number) {
  const rotulos = new Int32Array(largura * altura);
  const pilha = new Int32Array(largura * altura);
  const componentes: Componente[] = [];

  for (let inicio = 0; inicio < escuro.length; inicio += 1) {
    if (!escuro[inicio] || rotulos[inicio]) continue;

    const rotulo = componentes.length + 1;
    const componente: Componente = {
      rotulo,
      area: 0,
      minX: largura,
      maxX: 0,
      minY: altura,
      maxY: 0,
    };
    let topo = 0;
    pilha[topo] = inicio;
    topo += 1;
    rotulos[inicio] = rotulo;

    while (topo > 0) {
      topo -= 1;
      const atual = pilha[topo];
      const x = atual % largura;
      const y = (atual - x) / largura;
      componente.area += 1;
      if (x < componente.minX) componente.minX = x;
      if (x > componente.maxX) componente.maxX = x;
      if (y < componente.minY) componente.minY = y;
      if (y > componente.maxY) componente.maxY = y;

      for (let vy = Math.max(0, y - 1); vy <= Math.min(altura - 1, y + 1); vy += 1) {
        for (let vx = Math.max(0, x - 1); vx <= Math.min(largura - 1, x + 1); vx += 1) {
          const vizinho = vy * largura + vx;
          if (escuro[vizinho] && !rotulos[vizinho]) {
            rotulos[vizinho] = rotulo;
            pilha[topo] = vizinho;
            topo += 1;
          }
        }
      }
    }
    componentes.push(componente);
  }
  return { rotulos, componentes };
}

/** Marca o que esta fora da forma; o que sobra e a forma com os furos preenchidos. */
function marcarExterior(
  componente: Componente,
  rotulos: Int32Array,
  largura: number,
  larguraLocal: number,
  alturaLocal: number,
): Uint8Array {
  const externo = new Uint8Array(larguraLocal * alturaLocal);
  const pilha = new Int32Array(larguraLocal * alturaLocal);
  const pertence = (lx: number, ly: number) =>
    lx > 0 &&
    ly > 0 &&
    lx < larguraLocal - 1 &&
    ly < alturaLocal - 1 &&
    rotulos[(componente.minY + ly - 1) * largura + componente.minX + lx - 1] === componente.rotulo;

  let topo = 1;
  pilha[0] = 0;
  externo[0] = 1;
  while (topo > 0) {
    topo -= 1;
    const atual = pilha[topo];
    const lx = atual % larguraLocal;
    const ly = (atual - lx) / larguraLocal;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = lx + dx;
      const ny = ly + dy;
      if (nx < 0 || ny < 0 || nx >= larguraLocal || ny >= alturaLocal) continue;
      const vizinho = ny * larguraLocal + nx;
      if (externo[vizinho] || pertence(nx, ny)) continue;
      externo[vizinho] = 1;
      pilha[topo] = vizinho;
      topo += 1;
    }
  }
  return externo;
}

/** Decide se o componente tem forma de marcador e se ele e solido ou vazado. */
function analisarComponente(
  componente: Componente,
  rotulos: Int32Array,
  largura: number,
  altura: number,
  fracaoDoFuro: number,
): Candidato | undefined {
  const { minX, maxX, minY, maxY, area } = componente;
  const larguraDaCaixa = maxX - minX + 1;
  const alturaDaCaixa = maxY - minY + 1;
  const ladoMaximo = Math.max(largura, altura) * LADO_MAXIMO_RELATIVO;

  // Encostado na borda da imagem, o marcador pode estar cortado.
  if (minX === 0 || minY === 0 || maxX === largura - 1 || maxY === altura - 1) return undefined;
  if (Math.min(larguraDaCaixa, alturaDaCaixa) < LADO_MINIMO_PX) return undefined;
  if (Math.max(larguraDaCaixa, alturaDaCaixa) > ladoMaximo) return undefined;
  if (
    Math.max(larguraDaCaixa, alturaDaCaixa) / Math.min(larguraDaCaixa, alturaDaCaixa) >
    ASPECTO_MAXIMO_DA_CAIXA
  ) {
    return undefined;
  }
  if (area < larguraDaCaixa * alturaDaCaixa * OCUPACAO_MINIMA_DA_CAIXA) return undefined;

  const larguraLocal = larguraDaCaixa + 2;
  const alturaLocal = alturaDaCaixa + 2;
  const externo = marcarExterior(componente, rotulos, largura, larguraLocal, alturaLocal);

  const pontos: number[] = [];
  let somaX = 0;
  let somaY = 0;
  let furo = 0;
  let somaFuroX = 0;
  let somaFuroY = 0;
  for (let ly = 1; ly < alturaLocal - 1; ly += 1) {
    for (let lx = 1; lx < larguraLocal - 1; lx += 1) {
      if (externo[ly * larguraLocal + lx]) continue;
      const x = minX + lx - 1;
      const y = minY + ly - 1;
      pontos.push(x, y);
      somaX += x;
      somaY += y;
      if (rotulos[y * largura + x] !== componente.rotulo) {
        furo += 1;
        somaFuroX += x;
        somaFuroY += y;
      }
    }
  }

  const areaCheia = pontos.length / 2;
  const centro = { x: somaX / areaCheia, y: somaY / areaCheia };
  const lado = Math.sqrt(areaCheia);

  let mu20 = 0;
  let mu02 = 0;
  let mu11 = 0;
  for (let i = 0; i < pontos.length; i += 2) {
    const dx = pontos[i] - centro.x;
    const dy = pontos[i + 1] - centro.y;
    mu20 += dx * dx;
    mu02 += dy * dy;
    mu11 += dx * dy;
  }
  const anisotropia = Math.sqrt((mu20 - mu02) ** 2 + 4 * mu11 ** 2) / (mu20 + mu02);
  if (anisotropia > ANISOTROPIA_MAXIMA) return undefined;
  if (medirQuadratura(pontos, centro, areaCheia) < QUADRATURA_MINIMA) return undefined;

  const proporcaoDoFuro = furo / areaCheia;
  let vazado = false;
  if (proporcaoDoFuro >= fracaoDoFuro / 2) {
    // Furo grande demais e o desenho de um localizador de QR Code, nao um marcador.
    if (proporcaoDoFuro > fracaoDoFuro * 2) return undefined;
    const desvio = Math.hypot(somaFuroX / furo - centro.x, somaFuroY / furo - centro.y);
    if (desvio > lado * DESVIO_MAXIMO_DO_FURO) return undefined;
    vazado = true;
  }

  return { centro, lado, vazado };
}

/** Razao entre a area do quadrilatero dos quatro extremos e a area da forma. */
function medirQuadratura(pontos: number[], centro: Ponto, areaCheia: number): number {
  const maisDistante = (origem: Ponto): Ponto => {
    let melhor = origem;
    let distancia = -1;
    for (let i = 0; i < pontos.length; i += 2) {
      const d = (pontos[i] - origem.x) ** 2 + (pontos[i + 1] - origem.y) ** 2;
      if (d > distancia) {
        distancia = d;
        melhor = { x: pontos[i], y: pontos[i + 1] };
      }
    }
    return melhor;
  };

  const a = maisDistante(centro);
  const b = maisDistante(a);
  const diagonal = Math.hypot(b.x - a.x, b.y - a.y);
  if (diagonal === 0) return 0;

  let alturaPositiva = 0;
  let alturaNegativa = 0;
  for (let i = 0; i < pontos.length; i += 2) {
    const h = ((b.x - a.x) * (pontos[i + 1] - a.y) - (b.y - a.y) * (pontos[i] - a.x)) / diagonal;
    if (h > alturaPositiva) alturaPositiva = h;
    if (h < alturaNegativa) alturaNegativa = h;
  }

  // Soma meia diagonal de pixel em cada ponta: os pontos sao centros de pixels.
  const areaDoQuadrilatero =
    0.5 * (diagonal + Math.SQRT2) * (alturaPositiva - alturaNegativa + Math.SQRT2);
  return areaDoQuadrilatero / areaCheia;
}

function distancia(a: Ponto, b: Ponto): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function desvioDoAnguloReto(vertice: Ponto, a: Ponto, b: Ponto): number {
  const ux = a.x - vertice.x;
  const uy = a.y - vertice.y;
  const vx = b.x - vertice.x;
  const vy = b.y - vertice.y;
  const cosseno = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
  const graus = (Math.acos(Math.max(-1, Math.min(1, cosseno))) * 180) / Math.PI;
  return Math.abs(graus - 90);
}

/** Atribui os cantos a partir do vazado, em sentido horario na imagem. */
function ordenarCantos(vazado: Candidato, a: Candidato, b: Candidato, c: Candidato) {
  const trio = [a, b, c].sort(
    (p, q) => distancia(q.centro, vazado.centro) - distancia(p.centro, vazado.centro),
  );
  const [oposto, primeiro, segundo] = trio;
  const dx = oposto.centro.x - vazado.centro.x;
  const dy = oposto.centro.y - vazado.centro.y;
  const lado = (p: Candidato) =>
    dx * (p.centro.y - vazado.centro.y) - dy * (p.centro.x - vazado.centro.x);
  const ladoDoPrimeiro = lado(primeiro);
  const ladoDoSegundo = lado(segundo);
  if (ladoDoPrimeiro * ladoDoSegundo >= 0) return undefined;

  const cantos: Cantos = {
    superiorEsquerdo: vazado,
    superiorDireito: ladoDoPrimeiro < 0 ? primeiro : segundo,
    inferiorDireito: oposto,
    inferiorEsquerdo: ladoDoPrimeiro < 0 ? segundo : primeiro,
  };
  return cantos;
}

/** Quanto menor, mais a combinacao se parece com a folha. Invalida devolve `undefined`. */
function pontuarGeometria(cantos: Cantos, layout: LayoutDeMarcadores): number | undefined {
  const se = cantos.superiorEsquerdo;
  const sd = cantos.superiorDireito;
  const id = cantos.inferiorDireito;
  const ie = cantos.inferiorEsquerdo;

  const topo = distancia(se.centro, sd.centro);
  const base = distancia(ie.centro, id.centro);
  const esquerda = distancia(se.centro, ie.centro);
  const direita = distancia(sd.centro, id.centro);
  if (Math.min(topo, base, esquerda, direita) === 0) return undefined;

  const recuo = layout.margemMm + layout.ladoDoMarcadorMm / 2;
  const larguraEsperada = layout.larguraDaFolhaMm - 2 * recuo;
  const alturaEsperada = layout.alturaDaFolhaMm - 2 * recuo;

  const horizontal = (topo + base) / 2;
  const vertical = (esquerda + direita) / 2;
  const desvioHorizontal = Math.abs(Math.log(topo / base));
  const desvioVertical = Math.abs(Math.log(esquerda / direita));
  const desvioDeAspecto = Math.abs(
    Math.log(vertical / horizontal / (alturaEsperada / larguraEsperada)),
  );
  const ladoMedio = (se.lado + sd.lado + id.lado + ie.lado) / 4;
  const desvioDeTamanho = Math.abs(
    Math.log(ladoMedio / horizontal / (layout.ladoDoMarcadorMm / larguraEsperada)),
  );

  const limiteOpostos = Math.log(RAZAO_MAXIMA_ENTRE_LADOS_OPOSTOS);
  if (desvioHorizontal > limiteOpostos || desvioVertical > limiteOpostos) return undefined;
  if (desvioDeAspecto > Math.log(RAZAO_MAXIMA_DE_ASPECTO)) return undefined;
  if (desvioDeTamanho > Math.log(RAZAO_MAXIMA_ENTRE_MARCADORES)) return undefined;

  const angulos = [
    desvioDoAnguloReto(se.centro, sd.centro, ie.centro),
    desvioDoAnguloReto(sd.centro, se.centro, id.centro),
    desvioDoAnguloReto(id.centro, sd.centro, ie.centro),
    desvioDoAnguloReto(ie.centro, se.centro, id.centro),
  ];
  if (Math.max(...angulos) > DESVIO_MAXIMO_DE_ANGULO_GRAUS) return undefined;
  const somaDosAngulos = angulos.reduce((soma, angulo) => soma + (angulo * Math.PI) / 180, 0);

  return desvioHorizontal + desvioVertical + desvioDeAspecto + desvioDeTamanho + somaDosAngulos;
}

function escolherCantos(
  candidatos: Candidato[],
  layout: LayoutDeMarcadores,
): { cantos: Cantos } | { motivo: MotivoDaFalha } {
  const vazados = candidatos.filter((item) => item.vazado);
  const solidos = candidatos.filter((item) => !item.vazado);
  if (vazados.length === 0) return { motivo: 'sem_marcador_vazado' };
  if (solidos.length < 3) return { motivo: 'marcadores_insuficientes' };

  let melhor: Cantos | undefined;
  let melhorPontuacao = Infinity;
  let segundaPontuacao = Infinity;

  // A distancia entre marcadores e proporcional ao lado deles: descarta manchas de ruido.
  const recuo = layout.margemMm + layout.ladoDoMarcadorMm / 2;
  const larguraEntreCentros = layout.larguraDaFolhaMm - 2 * recuo;
  const alturaEntreCentros = layout.alturaDaFolhaMm - 2 * recuo;
  const menorDistanciaRelativa =
    Math.min(larguraEntreCentros, alturaEntreCentros) / layout.ladoDoMarcadorMm;
  const maiorDistanciaRelativa =
    Math.hypot(larguraEntreCentros, alturaEntreCentros) / layout.ladoDoMarcadorMm;

  for (const vazado of vazados) {
    const distanciaMinima = (vazado.lado * menorDistanciaRelativa) / RAZAO_MAXIMA_ENTRE_MARCADORES;
    const distanciaMaxima = vazado.lado * maiorDistanciaRelativa * RAZAO_MAXIMA_ENTRE_MARCADORES;
    const compativeis = solidos.filter((item) => {
      const razaoDeTamanho = Math.max(item.lado, vazado.lado) / Math.min(item.lado, vazado.lado);
      const separacao = distancia(item.centro, vazado.centro);
      return (
        razaoDeTamanho <= RAZAO_MAXIMA_ENTRE_MARCADORES &&
        separacao >= distanciaMinima &&
        separacao <= distanciaMaxima
      );
    });
    if (compativeis.length > LIMITE_DE_CANDIDATOS) return { motivo: 'candidatos_demais' };

    for (let i = 0; i < compativeis.length; i += 1) {
      for (let j = i + 1; j < compativeis.length; j += 1) {
        for (let k = j + 1; k < compativeis.length; k += 1) {
          const cantos = ordenarCantos(vazado, compativeis[i], compativeis[j], compativeis[k]);
          if (!cantos) continue;
          const pontuacao = pontuarGeometria(cantos, layout);
          if (pontuacao === undefined) continue;
          if (pontuacao < melhorPontuacao) {
            segundaPontuacao = melhorPontuacao;
            melhorPontuacao = pontuacao;
            melhor = cantos;
          } else if (pontuacao < segundaPontuacao) {
            segundaPontuacao = pontuacao;
          }
        }
      }
    }
  }

  if (!melhor) return { motivo: 'geometria_invalida' };
  if (segundaPontuacao - melhorPontuacao < MARGEM_DE_AMBIGUIDADE) {
    return { motivo: 'leitura_ambigua' };
  }
  return { cantos: melhor };
}

function medirRotacao({
  superiorEsquerdo,
  superiorDireito,
  inferiorDireito,
  inferiorEsquerdo,
}: Cantos) {
  const vx =
    superiorDireito.centro.x -
    superiorEsquerdo.centro.x +
    inferiorDireito.centro.x -
    inferiorEsquerdo.centro.x;
  const vy =
    superiorDireito.centro.y -
    superiorEsquerdo.centro.y +
    inferiorDireito.centro.y -
    inferiorEsquerdo.centro.y;
  const graus = ((Math.atan2(vy, vx) * 180) / Math.PI + 360) % 360;
  const orientacao = ((Math.round(graus / 90) % 4) * 90) as OrientacaoDaFolha;
  let inclinacaoGraus = graus - orientacao;
  if (inclinacaoGraus > 180) inclinacaoGraus -= 360;
  return { orientacao, inclinacaoGraus };
}

/** Localiza os marcadores. Sem certeza, devolve o motivo da falha em vez de um palpite. */
export function detectarMarcadores(
  imagem: ImagemRgba,
  layout: LayoutDeMarcadores = LAYOUT_PROVISORIO,
): ResultadoDaDeteccao {
  const inicio = Date.now();
  const { largura, altura, dados } = imagem;
  if (largura <= 0 || altura <= 0 || dados.length !== largura * altura * 4) {
    return { ok: false, motivo: 'imagem_invalida', totalDeCandidatos: 0, tempoMs: 0 };
  }

  const fator = Math.max(1, Math.floor(Math.max(largura, altura) / MAIOR_LADO_DE_TRABALHO));
  const reduzida = paraCinzaReduzido(imagem, fator);
  const escuro = binarizar(reduzida);
  const { rotulos, componentes } = encontrarComponentes(escuro, reduzida.largura, reduzida.altura);

  const fracaoDoFuro = (layout.ladoDoFuroMm / layout.ladoDoMarcadorMm) ** 2;
  const candidatos: Candidato[] = [];
  for (const componente of componentes) {
    const candidato = analisarComponente(
      componente,
      rotulos,
      reduzida.largura,
      reduzida.altura,
      fracaoDoFuro,
    );
    if (candidato) candidatos.push(candidato);
  }

  const escolha = escolherCantos(candidatos, layout);
  if ('motivo' in escolha) {
    return {
      ok: false,
      motivo: escolha.motivo,
      totalDeCandidatos: candidatos.length,
      tempoMs: Date.now() - inicio,
    };
  }

  const paraOriginal = (candidato: Candidato): MarcadorDetectado => ({
    // O centro do pixel reduzido cobre um bloco de `fator` pixels da imagem original.
    centro: {
      x: (candidato.centro.x + 0.5) * fator - 0.5,
      y: (candidato.centro.y + 0.5) * fator - 0.5,
    },
    ladoPx: candidato.lado * fator,
    vazado: candidato.vazado,
  });

  return {
    ok: true,
    ...medirRotacao(escolha.cantos),
    marcadores: {
      superiorEsquerdo: paraOriginal(escolha.cantos.superiorEsquerdo),
      superiorDireito: paraOriginal(escolha.cantos.superiorDireito),
      inferiorDireito: paraOriginal(escolha.cantos.inferiorDireito),
      inferiorEsquerdo: paraOriginal(escolha.cantos.inferiorEsquerdo),
    },
    totalDeCandidatos: candidatos.length,
    tempoMs: Date.now() - inicio,
  };
}
