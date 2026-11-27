import type { ImagemRgba, Ponto } from './marcadores';

/**
 * Mede o preenchimento de cada bolha do cartao-resposta (issue #98).
 *
 * A leitura trabalha so com a posicao da opcao, nunca com a letra: quem chama traduz
 * `indiceDaOpcao` pelo `printedOrder` do gabarito. O resultado e so uma sugestao para a
 * revisao do professor. Os limites sao iniciais e precisam de calibracao com fotos reais.
 * Na duvida a questao vai para `revisar`; a alternativa mais escura nunca e escolhida.
 */

export type EstadoDaBolha = 'marcada' | 'vazia' | 'ambigua' | 'nao_localizada';
export type EstadoDaQuestao = 'respondida' | 'em_branco' | 'multipla' | 'revisar';

export interface LayoutDeBolhas {
  raioDaBolhaMm: number;
  questoes: {
    indiceDaQuestao: number;
    bolhas: { indiceDaOpcao: number; centroMm: Ponto }[];
  }[];
}

export interface LeituraDaBolha {
  indiceDaOpcao: number;
  estado: EstadoDaBolha;
  /** Fracao da area interna coberta por tinta, de 0 a 1. */
  preenchimento: number;
  /** De 0 a 1. Abaixo de 0,5 a bolha nao decide a questao sozinha. */
  confianca: number;
  centroPx?: Ponto;
}

export interface LeituraDaQuestao {
  indiceDaQuestao: number;
  estado: EstadoDaQuestao;
  /** Presente somente quando a questao esta `respondida`. */
  indiceMarcado?: number;
  bolhas: LeituraDaBolha[];
}

const LIMITE_DE_VAZIA = 0.15;
const LIMITE_DE_MARCADA = 0.6;
const CONFIANCA_AUTOMATICA = 0.5;
/** Escuridao relativa ao papel a partir da qual o ponto conta como tinta. */
const LIMIAR_DE_TINTA = 0.35;
/** Medidas em raios da bolha. A area interna fica longe do contorno impresso. */
const RAIO_INTERNO = 0.7;
const RAIOS_DO_ANEL = [1.3, 1.5, 1.7];
const DISTANCIA_MINIMA_ENTRE_BOLHAS = 1 + Math.max(...RAIOS_DO_ANEL);
const PONTOS_POR_VOLTA_DO_ANEL = 24;
const PASSOS_NO_RAIO_INTERNO = 6;
const FRACAO_MINIMA_DO_ANEL = 0.8;
/** Abaixo disso o papel esta escuro demais para separar tinta de sombra. */
const PAPEL_MINIMO = 50;
/** O papel e medido no arco mais proximo do ponto, para tolerar a borda de uma sombra. */
const MEIA_JANELA_DO_ARCO = 3;
/** Bolha preenchida cobre todos os setores; um setor falho indica preenchimento parcial. */
const SETORES_DA_AREA_INTERNA = 8;
const COBERTURA_MINIMA_POR_SETOR = 0.6;
/**
 * Tinta que transborda cobre o anel e se passa por papel. Por isso o anel e comparado com
 * o papel acima e abaixo da bolha, longe das vizinhas da mesma linha. O layout do cartao
 * (issue #92) precisa deixar essa area livre.
 */
const RAIOS_DO_PAPEL_DISTANTE = [2.5, 2.8];
const ANGULOS_DO_PAPEL_DISTANTE_GRAUS = [40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140];
const RAZAO_MINIMA_DO_ANEL = 0.75;
const RAZAO_MINIMA_ENTRE_LADOS = 0.75;
const DISTANCIA_MINIMA_NA_VERTICAL = 1 + Math.max(...RAIOS_DO_PAPEL_DISTANTE);

function criarPontosInternos(): Ponto[] {
  const passo = RAIO_INTERNO / PASSOS_NO_RAIO_INTERNO;
  const pontos: Ponto[] = [];
  for (let y = -PASSOS_NO_RAIO_INTERNO; y <= PASSOS_NO_RAIO_INTERNO; y += 1) {
    for (let x = -PASSOS_NO_RAIO_INTERNO; x <= PASSOS_NO_RAIO_INTERNO; x += 1) {
      if (Math.hypot(x, y) <= PASSOS_NO_RAIO_INTERNO) pontos.push({ x: x * passo, y: y * passo });
    }
  }
  return pontos;
}

function criarPontosDoAnel(): Ponto[] {
  const pontos: Ponto[] = [];
  for (const raio of RAIOS_DO_ANEL) {
    for (let i = 0; i < PONTOS_POR_VOLTA_DO_ANEL; i += 1) {
      const angulo = (2 * Math.PI * i) / PONTOS_POR_VOLTA_DO_ANEL;
      pontos.push({ x: raio * Math.cos(angulo), y: raio * Math.sin(angulo) });
    }
  }
  return pontos;
}

const PONTOS_INTERNOS = criarPontosInternos();
const PONTOS_DO_ANEL = criarPontosDoAnel();

function imagemValida({ largura, altura, dados }: ImagemRgba): boolean {
  return (
    Number.isInteger(largura) &&
    Number.isInteger(altura) &&
    largura > 0 &&
    altura > 0 &&
    dados.length === largura * altura * 4
  );
}

function layoutValido({ raioDaBolhaMm, questoes }: LayoutDeBolhas): boolean {
  if (!Number.isFinite(raioDaBolhaMm) || raioDaBolhaMm <= 0) return false;

  const centros: Ponto[] = [];
  for (const questao of questoes) {
    if (questao.bolhas.length === 0) return false;
    const opcoes = new Set(questao.bolhas.map((bolha) => bolha.indiceDaOpcao));
    if (opcoes.size !== questao.bolhas.length) return false;
    for (const { centroMm } of questao.bolhas) {
      if (!Number.isFinite(centroMm.x) || !Number.isFinite(centroMm.y)) return false;
      centros.push(centroMm);
    }
  }

  // O anel e o papel distante de uma bolha nao podem encostar em outra bolha.
  const distanciaMinima = DISTANCIA_MINIMA_ENTRE_BOLHAS * raioDaBolhaMm;
  const distanciaNaVertical = DISTANCIA_MINIMA_NA_VERTICAL * raioDaBolhaMm;
  for (let i = 0; i < centros.length; i += 1) {
    for (let j = i + 1; j < centros.length; j += 1) {
      const dy = Math.abs(centros[i].y - centros[j].y);
      const separacao = Math.hypot(centros[i].x - centros[j].x, dy);
      if (separacao < distanciaMinima) return false;
      if (dy >= separacao / 2 && separacao < distanciaNaVertical) return false;
    }
  }
  return true;
}

/** Menor canal: caneta azul ou vermelha conta como tinta tanto quanto a preta. */
function menorCanal(dados: ArrayLike<number>, indice: number): number {
  return Math.min(dados[indice], dados[indice + 1], dados[indice + 2]);
}

function amostrar({ largura, altura, dados }: ImagemRgba, ponto: Ponto): number | undefined {
  const { x, y } = ponto;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  if (x < 0 || y < 0 || x > largura - 1 || y > altura - 1) return undefined;

  const x0 = Math.min(Math.floor(x), largura - 2);
  const y0 = Math.min(Math.floor(y), altura - 2);
  if (x0 < 0 || y0 < 0) return undefined;
  const dx = x - x0;
  const dy = y - y0;
  const i = (y0 * largura + x0) * 4;
  const abaixo = i + largura * 4;
  const superior = menorCanal(dados, i) * (1 - dx) + menorCanal(dados, i + 4) * dx;
  const inferior = menorCanal(dados, abaixo) * (1 - dx) + menorCanal(dados, abaixo + 4) * dx;
  return superior * (1 - dy) + inferior * dy;
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

function naoLocalizada(indiceDaOpcao: number, centroPx?: Ponto): LeituraDaBolha {
  return { indiceDaOpcao, estado: 'nao_localizada', preenchimento: 0, confianca: 0, centroPx };
}

function classificar(
  preenchimento: number,
  menorCobertura: number,
): { estado: EstadoDaBolha; confianca: number } {
  if (preenchimento < LIMITE_DE_VAZIA) {
    return { estado: 'vazia', confianca: (LIMITE_DE_VAZIA - preenchimento) / LIMITE_DE_VAZIA };
  }
  if (preenchimento < LIMITE_DE_MARCADA) return { estado: 'ambigua', confianca: 0 };

  const confianca = (preenchimento - LIMITE_DE_MARCADA) / (1 - LIMITE_DE_MARCADA);
  return {
    estado: 'marcada',
    // Com um setor descoberto, a bolha continua marcada, mas nao decide a questao sozinha.
    confianca:
      menorCobertura < COBERTURA_MINIMA_POR_SETOR
        ? Math.min(confianca, CONFIANCA_AUTOMATICA - 0.01)
        : confianca,
  };
}

function indiceDoAngulo({ x, y }: Ponto, divisoes: number, arredondar: boolean): number {
  const volta = 2 * Math.PI;
  const fracao = ((Math.atan2(y, x) + volta) % volta) / volta;
  const indice = arredondar ? Math.round(fracao * divisoes) : Math.floor(fracao * divisoes);
  return indice % divisoes;
}

/** Mediana do papel em um arco centrado em cada angulo do anel. */
function medirPapelPorAngulo(anel: (number | undefined)[]): number[] {
  const voltas = RAIOS_DO_ANEL.length;
  return Array.from({ length: PONTOS_POR_VOLTA_DO_ANEL }, (_, angulo) => {
    const valores: number[] = [];
    for (let d = -MEIA_JANELA_DO_ARCO; d <= MEIA_JANELA_DO_ARCO; d += 1) {
      const vizinho = (angulo + d + PONTOS_POR_VOLTA_DO_ANEL) % PONTOS_POR_VOLTA_DO_ANEL;
      for (let volta = 0; volta < voltas; volta += 1) {
        const valor = anel[volta * PONTOS_POR_VOLTA_DO_ANEL + vizinho];
        if (valor !== undefined) valores.push(valor);
      }
    }
    return valores.length > 0 ? mediana(valores) : 0;
  });
}

function lerBolha(
  imagem: ImagemRgba,
  projetar: (pontoMm: Ponto) => Ponto,
  indiceDaOpcao: number,
  centroMm: Ponto,
  raioMm: number,
): LeituraDaBolha {
  const centroPx = projetar(centroMm);
  const noCartao = (deslocamento: Ponto) =>
    amostrar(
      imagem,
      projetar({
        x: centroMm.x + deslocamento.x * raioMm,
        y: centroMm.y + deslocamento.y * raioMm,
      }),
    );

  const anel = PONTOS_DO_ANEL.map(noCartao);
  const visiveis = anel.filter((valor) => valor !== undefined).length;
  if (visiveis < PONTOS_DO_ANEL.length * FRACAO_MINIMA_DO_ANEL) {
    return naoLocalizada(indiceDaOpcao, centroPx);
  }
  const papelPorAngulo = medirPapelPorAngulo(anel);
  if (papelPorAngulo.some((papel) => papel < PAPEL_MINIMO)) {
    return naoLocalizada(indiceDaOpcao, centroPx);
  }

  const pontosClaros = anel.filter(
    (valor, i) =>
      valor !== undefined &&
      valor >= papelPorAngulo[i % PONTOS_POR_VOLTA_DO_ANEL] * (1 - LIMIAR_DE_TINTA),
  ).length;
  if (pontosClaros < PONTOS_DO_ANEL.length * FRACAO_MINIMA_DO_ANEL) {
    return naoLocalizada(indiceDaOpcao, centroPx);
  }

  let pontosComTinta = 0;
  const totalPorSetor = new Array<number>(SETORES_DA_AREA_INTERNA).fill(0);
  const tintaPorSetor = new Array<number>(SETORES_DA_AREA_INTERNA).fill(0);
  for (const deslocamento of PONTOS_INTERNOS) {
    const valor = noCartao(deslocamento);
    if (valor === undefined) return naoLocalizada(indiceDaOpcao, centroPx);

    const papel = papelPorAngulo[indiceDoAngulo(deslocamento, PONTOS_POR_VOLTA_DO_ANEL, true)];
    const setor = indiceDoAngulo(deslocamento, SETORES_DA_AREA_INTERNA, false);
    totalPorSetor[setor] += 1;
    if (1 - valor / papel >= LIMIAR_DE_TINTA) {
      pontosComTinta += 1;
      tintaPorSetor[setor] += 1;
    }
  }

  const preenchimento = pontosComTinta / PONTOS_INTERNOS.length;
  const menorCobertura = Math.min(
    ...totalPorSetor.map((total, setor) => tintaPorSetor[setor] / total),
  );
  return {
    indiceDaOpcao,
    preenchimento,
    centroPx,
    ...classificar(preenchimento, menorCobertura),
  };
}

/** Confere se o anel tem o brilho do papel ao redor, ou se esta coberto de tinta. */
function anelCompativelComPapel(
  imagem: ImagemRgba,
  projetar: (pontoMm: Ponto) => Ponto,
  centroMm: Ponto,
  raioMm: number,
): boolean {
  const valoresDefinidos = (valores: (number | undefined)[]) =>
    valores.filter((valor): valor is number => valor !== undefined);

  const anel = valoresDefinidos(
    PONTOS_DO_ANEL.map((deslocamento) =>
      amostrar(
        imagem,
        projetar({
          x: centroMm.x + deslocamento.x * raioMm,
          y: centroMm.y + deslocamento.y * raioMm,
        }),
      ),
    ),
  );
  const medirLado = (sinal: 1 | -1) => {
    const valores = valoresDefinidos(
      RAIOS_DO_PAPEL_DISTANTE.flatMap((raio) =>
        ANGULOS_DO_PAPEL_DISTANTE_GRAUS.map((graus) => {
          const angulo = (sinal * graus * Math.PI) / 180;
          return amostrar(
            imagem,
            projetar({
              x: centroMm.x + raio * raioMm * Math.cos(angulo),
              y: centroMm.y + raio * raioMm * Math.sin(angulo),
            }),
          );
        }),
      ),
    );
    return valores.length > 0 ? mediana(valores) : undefined;
  };

  const acima = medirLado(-1);
  const abaixo = medirLado(1);
  if (anel.length === 0 || acima === undefined || abaixo === undefined) return false;

  const papelDoAnel = mediana(anel);
  const ladoEscuro = Math.min(acima, abaixo);
  const ladoClaro = Math.max(acima, abaixo);
  if (papelDoAnel < RAZAO_MINIMA_DO_ANEL * ladoEscuro) return false;

  // Com uma borda de sombra entre os lados, o lado escuro nao serve de referencia: o anel
  // tambem precisa acompanhar o lado claro, ou a tinta pode se passar por sombra.
  return ladoEscuro >= RAZAO_MINIMA_ENTRE_LADOS * ladoClaro
    ? true
    : papelDoAnel >= RAZAO_MINIMA_DO_ANEL * ladoClaro;
}

function resumirQuestao(indiceDaQuestao: number, bolhas: LeituraDaBolha[]): LeituraDaQuestao {
  const marcadas = bolhas.filter((bolha) => bolha.estado === 'marcada');
  if (marcadas.length >= 2) return { indiceDaQuestao, estado: 'multipla', bolhas };

  const todasConfiaveis = bolhas.every(
    (bolha) =>
      (bolha.estado === 'marcada' || bolha.estado === 'vazia') &&
      bolha.confianca >= CONFIANCA_AUTOMATICA,
  );
  if (!todasConfiaveis) return { indiceDaQuestao, estado: 'revisar', bolhas };
  if (marcadas.length === 0) return { indiceDaQuestao, estado: 'em_branco', bolhas };
  return {
    indiceDaQuestao,
    estado: 'respondida',
    indiceMarcado: marcadas[0].indiceDaOpcao,
    bolhas,
  };
}

/**
 * Le as bolhas na imagem. `projetar` converte milimetros da folha em pixels da imagem.
 * Com imagem ou layout invalidos, todas as questoes voltam para revisao do professor.
 */
export function lerBolhas(
  imagem: ImagemRgba,
  projetar: (pontoMm: Ponto) => Ponto,
  layout: LayoutDeBolhas,
): LeituraDaQuestao[] {
  if (!imagemValida(imagem) || !layoutValido(layout)) {
    return layout.questoes.map((questao) => ({
      indiceDaQuestao: questao.indiceDaQuestao,
      estado: 'revisar',
      bolhas: questao.bolhas.map((bolha) => naoLocalizada(bolha.indiceDaOpcao)),
    }));
  }

  const raio = layout.raioDaBolhaMm;
  return layout.questoes.map((questao) =>
    resumirQuestao(
      questao.indiceDaQuestao,
      questao.bolhas.map((bolha) => {
        const leitura = lerBolha(imagem, projetar, bolha.indiceDaOpcao, bolha.centroMm, raio);
        if (leitura.estado === 'nao_localizada') return leitura;
        return anelCompativelComPapel(imagem, projetar, bolha.centroMm, raio)
          ? leitura
          : { ...leitura, estado: 'ambigua', confianca: 0 };
      }),
    ),
  );
}
