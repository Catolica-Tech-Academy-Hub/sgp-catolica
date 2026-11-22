import { decode } from 'jpeg-js';
import type { ImagemRgba } from './marcadores';

/**
 * Leitura dos pixels da foto do cartao-resposta no JavaScript do aplicativo (issue #98).
 */

/** Limites para uma foto grande falhar com erro claro em vez de derrubar o aplicativo. */
const LIMITE_DE_MEGAPIXELS = 16;
const LIMITE_DE_MEMORIA_MB = 256;

/** Tamanho minimo do lado maior da foto, em pixels. */
const MAIOR_LADO_DESEJADO = 1600;

const ALFABETO_BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const INVALIDO = 255;
const VALORES_BASE64 = new Uint8Array(128).fill(INVALIDO);
for (let indice = 0; indice < ALFABETO_BASE64.length; indice += 1) {
  VALORES_BASE64[ALFABETO_BASE64.charCodeAt(indice)] = indice;
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

/** Decodifica o JPEG em RGBA, dentro dos limites de tamanho e memoria. */
export function decodificarJpeg(bytes: Uint8Array): ImagemRgba {
  const imagem = decode(bytes, {
    useTArray: true,
    formatAsRGBA: true,
    maxResolutionInMP: LIMITE_DE_MEGAPIXELS,
    maxMemoryUsageInMB: LIMITE_DE_MEMORIA_MB,
  });
  return { largura: imagem.width, altura: imagem.height, dados: imagem.data };
}
