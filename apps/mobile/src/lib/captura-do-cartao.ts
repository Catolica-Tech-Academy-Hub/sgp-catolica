import type { ImagemRgba, Ponto } from '../viabilidade/marcadores';
import { base64ParaBytes, decodificarJpeg } from '../viabilidade/obter-pixels';
import type { AreaDetectada } from './leitura-do-cartao';

/**
 * Prepara a foto do cartao-resposta para a leitura e para o feedback visual (RF08, #98).
 *
 * O decodificador entrega os pixels como foram gravados, enquanto a tela aplica a orientacao
 * EXIF ao mostrar a foto. A leitura nao precisa dela, porque os marcadores ja revelam a
 * rotacao da folha, mas a area desenhada sobre a foto precisa seguir a mesma orientacao.
 */

export type OrientacaoExif = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface FotoPreparada {
  imagem: ImagemRgba;
  orientacao: OrientacaoExif;
}

export interface SegmentoDaArea {
  /** Centro do segmento, em pixels da moldura. */
  x: number;
  y: number;
  comprimento: number;
  anguloRad: number;
}

const MARCADOR_SOI = 0xd8;
const MARCADOR_SOS = 0xda;
const MARCADOR_EOI = 0xd9;
const MARCADOR_APP1 = 0xe1;
const TAG_ORIENTACAO = 0x0112;
const TIPO_SHORT = 3;
const TAMANHO_DA_ENTRADA_IFD = 12;
const CABECALHO_EXIF = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];

function orientacaoDoTiff(bytes: Uint8Array, inicio: number, fim: number): OrientacaoExif {
  if (inicio + 8 > fim) return 1;
  const ordem = (bytes[inicio] << 8) | bytes[inicio + 1];
  if (ordem !== 0x4949 && ordem !== 0x4d4d) return 1;
  const littleEndian = ordem === 0x4949;

  const u16 = (posicao: number) =>
    littleEndian
      ? bytes[posicao] | (bytes[posicao + 1] << 8)
      : (bytes[posicao] << 8) | bytes[posicao + 1];
  const u32 = (posicao: number) =>
    littleEndian
      ? (u16(posicao) + u16(posicao + 2) * 0x10000) >>> 0
      : (u16(posicao) * 0x10000 + u16(posicao + 2)) >>> 0;

  if (u16(inicio + 2) !== 42) return 1;
  const ifd = inicio + u32(inicio + 4);
  if (ifd + 2 > fim) return 1;

  const entradas = u16(ifd);
  for (let indice = 0; indice < entradas; indice += 1) {
    const entrada = ifd + 2 + indice * TAMANHO_DA_ENTRADA_IFD;
    if (entrada + TAMANHO_DA_ENTRADA_IFD > fim) return 1;
    if (u16(entrada) !== TAG_ORIENTACAO) continue;
    if (u16(entrada + 2) !== TIPO_SHORT || u32(entrada + 4) !== 1) return 1;
    const valor = u16(entrada + 8);
    return valor >= 1 && valor <= 8 ? (valor as OrientacaoExif) : 1;
  }
  return 1;
}

/** Le a orientacao EXIF do JPEG. Sem dado valido, considera a foto como gravada. */
export function lerOrientacaoExif(bytes: Uint8Array): OrientacaoExif {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== MARCADOR_SOI) return 1;

  let posicao = 2;
  while (posicao + 4 <= bytes.length) {
    if (bytes[posicao] !== 0xff) return 1;
    const marcador = bytes[posicao + 1];
    if (marcador === 0xff) {
      posicao += 1;
      continue;
    }
    if (marcador === MARCADOR_SOS || marcador === MARCADOR_EOI) return 1;

    const tamanho = (bytes[posicao + 2] << 8) | bytes[posicao + 3];
    const fim = posicao + 2 + tamanho;
    if (tamanho < 2 || fim > bytes.length) return 1;

    const dados = posicao + 4;
    const eExif =
      marcador === MARCADOR_APP1 &&
      dados + CABECALHO_EXIF.length <= fim &&
      CABECALHO_EXIF.every((valor, indice) => bytes[dados + indice] === valor);
    if (eExif) return orientacaoDoTiff(bytes, dados + CABECALHO_EXIF.length, fim);
    posicao = fim;
  }
  return 1;
}

/** Converte a foto da camera em pixels. Rejeita quando ela nao e um JPEG legivel. */
export function prepararFoto(base64: string): FotoPreparada {
  const bytes = base64ParaBytes(base64);
  return { imagem: decodificarJpeg(bytes), orientacao: lerOrientacaoExif(bytes) };
}

/** `falhou` fica disponivel para a tela avisar que a foto pode continuar no aparelho. */
export type ResultadoDoDescarte = 'removida' | 'sem_arquivo' | 'falhou';

/**
 * Apaga o arquivo temporario que a camera grava no cache. A foto pode conter nome, matricula
 * e respostas do aluno, entao nao deve ficar no aparelho. Uma falha aqui nunca derruba a
 * leitura, porque os bytes da foto ja estao em memoria.
 */
export async function descartarFoto(
  uri: string | undefined,
  apagar: (uri: string) => Promise<void>,
): Promise<ResultadoDoDescarte> {
  if (!uri || !uri.startsWith('file://')) return 'sem_arquivo';
  try {
    await apagar(uri);
    return 'removida';
  } catch {
    return 'falhou';
  }
}

function pontoNaFotoExibida(
  { x, y }: Ponto,
  largura: number,
  altura: number,
  orientacao: OrientacaoExif,
): Ponto {
  switch (orientacao) {
    case 2:
      return { x: largura - x, y };
    case 3:
      return { x: largura - x, y: altura - y };
    case 4:
      return { x, y: altura - y };
    case 5:
      return { x: y, y: x };
    case 6:
      return { x: altura - y, y: x };
    case 7:
      return { x: altura - y, y: largura - x };
    case 8:
      return { x: y, y: largura - x };
    default:
      return { x, y };
  }
}

/** Leva a area dos pixels gravados para a foto como ela aparece na tela. */
export function areaNaFotoExibida(area: AreaDetectada, orientacao: OrientacaoExif): AreaDetectada {
  const troca = orientacao >= 5;
  const [a, b, c, d] = area.cantos.map((canto) =>
    pontoNaFotoExibida(canto, area.largura, area.altura, orientacao),
  );
  return {
    largura: troca ? area.altura : area.largura,
    altura: troca ? area.largura : area.altura,
    cantos: [a, b, c, d],
  };
}

/** Os quatro lados da area, na escala da moldura, para desenhar sem biblioteca de vetor. */
export function segmentosDaArea(cantos: AreaDetectada['cantos'], escala: number): SegmentoDaArea[] {
  return cantos.map((canto, indice) => {
    const proximo = cantos[(indice + 1) % cantos.length];
    const dx = (proximo.x - canto.x) * escala;
    const dy = (proximo.y - canto.y) * escala;
    return {
      x: ((canto.x + proximo.x) / 2) * escala,
      y: ((canto.y + proximo.y) / 2) * escala,
      comprimento: Math.hypot(dx, dy),
      anguloRad: Math.atan2(dy, dx),
    };
  });
}
