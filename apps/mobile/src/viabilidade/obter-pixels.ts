import { decode } from 'jpeg-js';

/**
 * Etapa 0 da issue #98: prova de que o JavaScript do aplicativo consegue ler os pixels
 * de uma foto. Codigo temporario, fora do fluxo de correcao e sem nenhuma leitura de
 * cartao.
 */

/** Limites para uma foto grande falhar com erro claro em vez de derrubar o aplicativo. */
const LIMITE_DE_MEGAPIXELS = 16;
const LIMITE_DE_MEMORIA_MB = 256;

/** Tamanho minimo do lado maior da foto de teste, em pixels. */
const MAIOR_LADO_DESEJADO = 1600;

const ALFABETO_BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const INVALIDO = 255;
const VALORES_BASE64 = new Uint8Array(128).fill(INVALIDO);
for (let indice = 0; indice < ALFABETO_BASE64.length; indice += 1) {
  VALORES_BASE64[ALFABETO_BASE64.charCodeAt(indice)] = indice;
}

export interface AmostraDePixel {
  rotulo: string;
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ResultadoDosPixels {
  largura: number;
  altura: number;
  totalDeBytes: number;
  bytesEsperados: number;
  amostras: AmostraDePixel[];
  brilho: { minimo: number; medio: number; maximo: number };
  tempos: { conversaoMs: number; decodificacaoMs: number; analiseMs: number };
}

/** Converte base64 em bytes sem depender de `Buffer` ou `atob` no runtime do aparelho. */
export function base64ParaBytes(base64: string): Uint8Array {
  const saida = new Uint8Array(Math.floor((base64.length * 3) / 4));
  let acumulado = 0;
  let bits = 0;
  let posicao = 0;

  for (let indice = 0; indice < base64.length; indice += 1) {
    const codigo = base64.charCodeAt(indice);
    const valor = codigo < 128 ? VALORES_BASE64[codigo] : INVALIDO;
    // Ignora `=` e quebras de linha, que nao carregam dados.
    if (valor === INVALIDO) continue;

    acumulado = (acumulado << 6) | valor;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      saida[posicao] = (acumulado >> bits) & 0xff;
      posicao += 1;
      acumulado &= (1 << bits) - 1;
    }
  }

  return saida.subarray(0, posicao);
}

/**
 * Escolhe a menor resolucao com lado maior suficiente, para nao decodificar 12 MP em
 * JavaScript. Sem nenhuma opcao suficiente, fica com a maior disponivel.
 */
export function escolherTamanhoDaFoto(tamanhos: string[]): string | undefined {
  const validos = tamanhos.flatMap((tamanho) => {
    const partes = /^(\d+)x(\d+)$/i.exec(tamanho.trim());
    if (!partes) return [];
    const largura = Number(partes[1]);
    const altura = Number(partes[2]);
    return [{ tamanho, area: largura * altura, maiorLado: Math.max(largura, altura) }];
  });

  const suficientes = validos
    .filter((item) => item.maiorLado >= MAIOR_LADO_DESEJADO)
    .sort((a, b) => a.area - b.area);
  if (suficientes.length > 0) return suficientes[0].tamanho;

  return [...validos].sort((a, b) => b.area - a.area)[0]?.tamanho;
}

function lerAmostra(
  dados: Uint8Array,
  largura: number,
  altura: number,
  rotulo: string,
  proporcaoX: number,
  proporcaoY: number,
): AmostraDePixel {
  const x = Math.min(largura - 1, Math.floor(largura * proporcaoX));
  const y = Math.min(altura - 1, Math.floor(altura * proporcaoY));
  const inicio = (y * largura + x) * 4;
  return {
    rotulo,
    x,
    y,
    r: dados[inicio],
    g: dados[inicio + 1],
    b: dados[inicio + 2],
    a: dados[inicio + 3],
  };
}

/** Decodifica o JPEG em RGBA e resume o que foi lido, para conferencia na tela. */
export function obterPixels(base64: string): ResultadoDosPixels {
  const inicio = Date.now();
  const bytes = base64ParaBytes(base64);
  const aposConversao = Date.now();

  const imagem = decode(bytes, {
    useTArray: true,
    formatAsRGBA: true,
    maxResolutionInMP: LIMITE_DE_MEGAPIXELS,
    maxMemoryUsageInMB: LIMITE_DE_MEMORIA_MB,
  });
  const aposDecodificacao = Date.now();

  const { width: largura, height: altura, data: dados } = imagem;
  let minimo = 255;
  let maximo = 0;
  let soma = 0;
  for (let indice = 0; indice < dados.length; indice += 4) {
    const brilho = 0.299 * dados[indice] + 0.587 * dados[indice + 1] + 0.114 * dados[indice + 2];
    if (brilho < minimo) minimo = brilho;
    if (brilho > maximo) maximo = brilho;
    soma += brilho;
  }
  const totalDePixels = largura * altura;

  const amostras = [
    lerAmostra(dados, largura, altura, 'Centro', 0.5, 0.5),
    lerAmostra(dados, largura, altura, 'Sup. esq.', 0.1, 0.1),
    lerAmostra(dados, largura, altura, 'Sup. dir.', 0.9, 0.1),
    lerAmostra(dados, largura, altura, 'Inf. esq.', 0.1, 0.9),
    lerAmostra(dados, largura, altura, 'Inf. dir.', 0.9, 0.9),
  ];
  const fim = Date.now();

  return {
    largura,
    altura,
    totalDeBytes: dados.length,
    bytesEsperados: totalDePixels * 4,
    amostras,
    brilho: {
      minimo: Math.round(minimo),
      medio: Math.round(soma / totalDePixels),
      maximo: Math.round(maximo),
    },
    tempos: {
      conversaoMs: aposConversao - inicio,
      decodificacaoMs: aposDecodificacao - aposConversao,
      analiseMs: fim - aposDecodificacao,
    },
  };
}
