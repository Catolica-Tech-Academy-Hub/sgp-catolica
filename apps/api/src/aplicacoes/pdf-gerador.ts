import { BadRequestException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type { LayoutVersao } from '@sgp/shared-types';

const MM = 72 / 25.4;
const PAGE_WIDTH = 210 * MM;
const PAGE_HEIGHT = 297 * MM;
const MARGIN = 16 * MM;
const BOTTOM = PAGE_HEIGHT - MARGIN - 18;
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export interface CamposCabecalhoPdf {
  nome: boolean;
  matricula: boolean;
  turma: boolean;
  data: boolean;
  nota: boolean;
}

export interface CabecalhoPdf {
  instituicao: string;
  linhaComplementar: string;
  professor: string;
  instrucoes: string;
  campos: CamposCabecalhoPdf;
}

export interface QuestaoParaPdf {
  id: string;
  type: 'objetiva' | 'discursiva';
  statement: string;
  score: string;
  alternatives: Array<{ id: string; text: string }>;
}

export interface BlocoParaPdf {
  type: string;
  questionId?: string;
  titulo?: string;
  descricao?: string;
  conteudo?: string;
  estilo?: string;
  url?: string;
  legenda?: string;
  tamanho?: string;
  formatoResposta?: string;
}

export interface AtribuicaoPdf {
  studentId: string;
  fullName: string;
  registration: string | null;
  qrCodePayload: string;
}

export interface VersaoPdf {
  versionNumber: number;
  qrCodePayload: string;
  layout: LayoutVersao;
  assignments: AtribuicaoPdf[];
}

export interface DadosPdfAplicacao {
  title: string;
  description: string | null;
  totalScore: number;
  blocks: BlocoParaPdf[] | null;
  questions: QuestaoParaPdf[];
  className: string;
  subject: string;
  header: CabecalhoPdf;
  versions: VersaoPdf[];
}

interface BlocoImprimivel {
  type: 'titulo' | 'texto' | 'imagem' | 'questao' | 'espaco';
  block: BlocoParaPdf;
  question?: QuestaoParaPdf;
  number?: number;
  alternatives?: Array<{ id: string; text: string }>;
}

function pontos(mm: number): number {
  return mm * MM;
}

function textoMarkdown(texto: string): string {
  return texto
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim();
}

function erroDeConteudo(mensagem: string): BadRequestException {
  return new BadRequestException(mensagem);
}

function ehTipoDeBloco(tipo: string): tipo is BlocoImprimivel['type'] {
  return (
    tipo === 'titulo' ||
    tipo === 'texto' ||
    tipo === 'imagem' ||
    tipo === 'questao' ||
    tipo === 'espaco'
  );
}

function criarBlocosImprimiveis(
  blocos: BlocoParaPdf[] | null,
  questoes: QuestaoParaPdf[],
  ordem: string[],
  alternativasPorQuestao: Map<string, string[]>,
): BlocoImprimivel[] {
  const questoesPorId = new Map(questoes.map((questao) => [questao.id, questao]));
  const questoesOrdenadas = ordem.map((id) => {
    const questao = questoesPorId.get(id);
    if (!questao) throw erroDeConteudo('A ordem da versão referencia uma questão indisponível.');
    const idsImpressos = alternativasPorQuestao.get(id) ?? [];
    const alternativas = idsImpressos.map((alternativeId) => {
      const alternativa = questao.alternatives.find((item) => item.id === alternativeId);
      if (!alternativa) {
        throw erroDeConteudo('A ordem da versão referencia uma alternativa indisponível.');
      }
      return alternativa;
    });
    if (!questao.statement.trim()) {
      throw erroDeConteudo('Todas as questões precisam ter um enunciado antes de gerar o PDF.');
    }
    if (
      questao.type === 'objetiva' &&
      (alternativas.length < 2 || alternativas.length > 5 || alternativas.some((item) => !item.text.trim()))
    ) {
      throw erroDeConteudo(
        'Cada questão objetiva precisa ter de duas a cinco alternativas preenchidas.',
      );
    }
    return { question: questao, alternatives: alternativas };
  });

  if (!blocos?.length) {
    return questoesOrdenadas.map(({ question, alternatives }, indice) => ({
      type: 'questao',
      block: { type: 'questao', questionId: question.id },
      question,
      alternatives,
      number: indice + 1,
    }));
  }

  const posicoesDeQuestoes = blocos
    .map((bloco, indice) => (bloco.type === 'questao' ? indice : -1))
    .filter((indice) => indice >= 0);
  if (posicoesDeQuestoes.length !== questoesOrdenadas.length) {
    throw erroDeConteudo(
      'Salve a prova novamente: as questões do editor não correspondem às questões persistidas.',
    );
  }

  const idsNosBlocos = posicoesDeQuestoes.map((indice) => blocos[indice].questionId);
  const idsValidados = idsNosBlocos.filter((id): id is string => typeof id === 'string');
  if (
    idsValidados.length !== idsNosBlocos.length ||
    new Set(idsValidados).size !== idsValidados.length ||
    idsValidados.some((id) => !questoesPorId.has(id))
  ) {
    throw erroDeConteudo(
      'A prova contém uma questão de rascunho ou não salva. Salve todas as questões antes de gerar o PDF.',
    );
  }

  let indiceQuestao = 0;
  let numeroImpresso = 0;
  return blocos.map((bloco) => {
    if (!ehTipoDeBloco(bloco.type)) {
      throw erroDeConteudo('A prova contém um bloco de impressão não reconhecido.');
    }
    if (bloco.type !== 'questao') {
      return { type: bloco.type, block: bloco };
    }
    const questaoOrdenada = questoesOrdenadas[indiceQuestao];
    indiceQuestao += 1;
    numeroImpresso += 1;
    return {
      type: 'questao',
      block: bloco,
      question: questaoOrdenada.question,
      alternatives: questaoOrdenada.alternatives,
      number: numeroImpresso,
    };
  });
}

function alturaDeTexto(
  documento: PDFKit.PDFDocument,
  texto: string,
  largura: number,
  tamanho: number,
  negrito = false,
): number {
  documento.font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(tamanho);
  return documento.heightOfString(texto || ' ', { width: largura, lineGap: 2 });
}

function desenharMarcador(
  documento: PDFKit.PDFDocument,
  xMm: number,
  yMm: number,
  vazado = false,
): void {
  const lado = pontos(10);
  const x = pontos(xMm);
  const y = pontos(yMm);
  documento.rect(x, y, lado, lado).fill('#111111');
  if (vazado) {
    const furo = pontos(4);
    documento.rect(x + (lado - furo) / 2, y + (lado - furo) / 2, furo, furo).fill('#ffffff');
  }
}

function desenharMarcadoresDaFolha(documento: PDFKit.PDFDocument): void {
  desenharMarcador(documento, 10, 10, true);
  desenharMarcador(documento, 190, 10);
  desenharMarcador(documento, 10, 277);
  desenharMarcador(documento, 190, 277);
}

function adicionarRodape(
  documento: PDFKit.PDFDocument,
  versao: number,
  pagina: number,
  nomeDoEstudante?: string,
): void {
  documento
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#555555')
    .text(
      `Versão ${versao}${nomeDoEstudante ? ` · ${nomeDoEstudante}` : ''} · Folha ${pagina}`,
      MARGIN,
      PAGE_HEIGHT - 30,
      { width: PAGE_WIDTH - MARGIN * 2, align: 'center' },
    );
}

function desenharCabecalho(
  documento: PDFKit.PDFDocument,
  dados: DadosPdfAplicacao,
  versao: number,
  qr: Buffer,
  estudante?: AtribuicaoPdf,
): number {
  const x = MARGIN;
  const qrSize = pontos(22);
  const qrX = PAGE_WIDTH - MARGIN - qrSize;
  let y = MARGIN;
  const larguraTexto = qrX - x - 14;
  const cabecalho = dados.header;

  const escrever = (texto: string, tamanho: number, bold = false, espacamento = 4) => {
    if (!texto) return;
    documento
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(tamanho)
      .fillColor('#111111')
      .text(textoMarkdown(texto), x, y, { width: larguraTexto, lineGap: 2 });
    y = documento.y + espacamento;
  };

  escrever(cabecalho.instituicao, 9, true, 3);
  escrever(cabecalho.linhaComplementar, 9, false, 5);
  escrever(dados.title || 'Prova sem título', 17, true, 5);
  escrever(dados.description ?? '', 10, false, 5);
  escrever(`Versão ${versao} · ${dados.subject}`, 9, false, 3);
  escrever(
    `Total: ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(dados.totalScore)} pontos`,
    9,
    false,
    3,
  );
  escrever(`Professor(a): ${cabecalho.professor}`, 9, false, 3);
  if (cabecalho.campos.turma) escrever(`Turma: ${dados.className}`, 9, false, 3);
  if (estudante) escrever(`Estudante: ${estudante.fullName}`, 10, true, 3);
  if (estudante && cabecalho.campos.matricula && estudante.registration) {
    escrever(`Matrícula: ${estudante.registration}`, 9, false, 3);
  }
  if (cabecalho.campos.nome && !estudante) escrever('Nome: ___________________________________', 9, false, 3);
  if (cabecalho.campos.data) escrever('Data: ____ / ____ / ______', 9, false, 3);
  if (cabecalho.campos.nota) escrever('Nota: __________', 9, false, 3);
  escrever(cabecalho.instrucoes, 9, false, 6);

  if (y > BOTTOM - 70) {
    throw erroDeConteudo('O cabeçalho configurado é grande demais para uma folha A4.');
  }

  documento.image(qr, qrX, MARGIN, { width: qrSize, height: qrSize });
  documento
    .moveTo(x, y)
    .lineTo(PAGE_WIDTH - MARGIN, y)
    .lineWidth(0.7)
    .strokeColor('#777777')
    .stroke();
  return y + 14;
}

function alturaDoBloco(
  documento: PDFKit.PDFDocument,
  bloco: BlocoImprimivel,
  largura: number,
): number {
  const { type, block, question, alternatives } = bloco;
  if (type === 'titulo') {
    const titulo = block.titulo ?? '';
    const descricao = block.descricao ?? '';
    return alturaDeTexto(documento, titulo, largura, 13, true) +
      (descricao ? alturaDeTexto(documento, descricao, largura, 9) + 4 : 0) +
      12;
  }
  if (type === 'texto') {
    return alturaDeTexto(documento, textoMarkdown(block.conteudo ?? ''), largura, 10) + 12;
  }
  if (type === 'imagem') {
    if (!block.url) return 0;
    const imagem = abrirImagem(block.url);
    const escala = Math.min(largura / imagem.width, pontos(150) / imagem.height, 1);
    const legenda = block.legenda ? alturaDeTexto(documento, block.legenda, largura, 8) + 5 : 0;
    return imagem.height * escala + legenda + 12;
  }
  if (type === 'espaco') {
    const linhas: Record<string, number> = { pequeno: 5, medio: 8, grande: 12 };
    return (linhas[block.tamanho ?? 'medio'] ?? 8) * 17 + 10;
  }
  if (!question) throw erroDeConteudo('Uma questão da prova não pôde ser carregada.');
  const larguraDoTexto = largura - 24;
  const larguraDoEnunciado = larguraDoTexto - 64;
  let altura =
    Math.max(
      alturaDeTexto(documento, `${bloco.number}.`, 20, 10, true),
      alturaDeTexto(documento, textoMarkdown(question.statement), larguraDoEnunciado, 10),
      alturaDeTexto(documento, `${question.score} pts`, 56, 9, true),
    ) + 8;
  if (question.type === 'objetiva') {
    for (const alternativa of alternatives ?? []) {
      altura += alturaDeTexto(documento, textoMarkdown(alternativa.text), larguraDoTexto - 38, 9) + 4;
    }
  } else {
    const linhas = block.formatoResposta === 'longa' ? 8 : 4;
    altura += linhas * 17 + 8;
  }
  return altura + 14;
}

function abrirImagem(url: string): { buffer: Buffer; width: number; height: number } {
  const captura = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(url);
  if (!captura) {
    throw erroDeConteudo('As imagens da prova precisam estar em PNG ou JPEG para gerar o PDF.');
  }
  const buffer = Buffer.from(captura[2].replace(/\s/g, ''), 'base64');
  if (captura[1].toLowerCase() === 'png') {
    if (
      buffer.length < 24 ||
      !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      throw erroDeConteudo('Uma imagem da prova está inválida ou não pode ser lida.');
    }
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width <= 0 || height <= 0) {
      throw erroDeConteudo('Uma imagem da prova está inválida ou não pode ser lida.');
    }
    return { buffer, width, height };
  }

  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw erroDeConteudo('Uma imagem da prova está inválida ou não pode ser lida.');
  }
  let deslocamento = 2;
  while (deslocamento + 8 < buffer.length) {
    if (buffer[deslocamento] !== 0xff) {
      deslocamento += 1;
      continue;
    }
    while (buffer[deslocamento] === 0xff) deslocamento += 1;
    const marcador = buffer[deslocamento];
    deslocamento += 1;
    if (marcador === 0xd9 || marcador === 0xda) break;
    const tamanho = buffer.readUInt16BE(deslocamento);
    if (tamanho < 2 || deslocamento + tamanho > buffer.length) break;
    if (
      (marcador >= 0xc0 && marcador <= 0xc3) ||
      (marcador >= 0xc5 && marcador <= 0xc7) ||
      (marcador >= 0xc9 && marcador <= 0xcb) ||
      (marcador >= 0xcd && marcador <= 0xcf)
    ) {
      const height = buffer.readUInt16BE(deslocamento + 3);
      const width = buffer.readUInt16BE(deslocamento + 5);
      if (width > 0 && height > 0) return { buffer, width, height };
      break;
    }
    deslocamento += tamanho;
  }
  throw erroDeConteudo('Uma imagem da prova está inválida ou não pode ser lida.');
}

function desenharBloco(
  documento: PDFKit.PDFDocument,
  bloco: BlocoImprimivel,
  x: number,
  largura: number,
): void {
  const inicio = documento.y;
  const { type, block, question, alternatives } = bloco;
  if (type === 'titulo') {
    const titulo = textoMarkdown(block.titulo ?? '');
    const descricao = textoMarkdown(block.descricao ?? '');
    documento.font('Helvetica-Bold').fontSize(13).fillColor('#111111').text(titulo, x, inicio, { width: largura });
    documento.y = documento.y + 3;
    if (descricao) {
      documento.font('Helvetica').fontSize(9).fillColor('#333333').text(descricao, x, documento.y, { width: largura });
    }
    documento.moveTo(x, documento.y + 5).lineTo(x + largura, documento.y + 5).strokeColor('#777777').stroke();
    documento.y += 14;
    return;
  }
  if (type === 'texto') {
    const texto = textoMarkdown(block.conteudo ?? '');
    if (block.estilo === 'destaque') {
      const altura = alturaDeTexto(documento, texto, largura - 16, 10) + 12;
      documento.roundedRect(x, inicio, largura, altura, 4).lineWidth(0.6).strokeColor('#777777').stroke();
      documento.font('Helvetica').fontSize(10).fillColor('#111111').text(texto, x + 8, inicio + 6, { width: largura - 16 });
      documento.y = inicio + altura + 8;
    } else {
      if (block.estilo === 'instrucoes') {
        documento.moveTo(x + 2, inicio).lineTo(x + 2, inicio + alturaDeTexto(documento, texto, largura - 12, 10)).lineWidth(1.5).strokeColor('#555555').stroke();
      }
      documento.font(block.estilo === 'instrucoes' ? 'Helvetica-Oblique' : 'Helvetica')
        .fontSize(10)
        .fillColor('#111111')
        .text(texto, x + (block.estilo === 'instrucoes' ? 10 : 0), inicio, {
          width: largura - (block.estilo === 'instrucoes' ? 10 : 0),
          lineGap: 2,
        });
      documento.y += 12;
    }
    return;
  }
  if (type === 'imagem') {
    if (!block.url) return;
    const imagem = abrirImagem(block.url);
    const escala = Math.min(largura / imagem.width, pontos(150) / imagem.height, 1);
    const altura = imagem.height * escala;
    const xImagem = x + (largura - imagem.width * escala) / 2;
    try {
      documento.image(imagem.buffer, xImagem, inicio, {
        width: imagem.width * escala,
        height: altura,
      });
    } catch {
      throw erroDeConteudo('Uma imagem da prova está inválida ou não pode ser lida.');
    }
    documento.y = inicio + altura + 4;
    if (block.legenda) {
      documento.font('Helvetica').fontSize(8).fillColor('#333333')
        .text(textoMarkdown(block.legenda), x, documento.y, { width: largura, align: 'center' });
    }
    documento.y += 12;
    return;
  }
  if (type === 'espaco') {
    const linhas: Record<string, number> = { pequeno: 5, medio: 8, grande: 12 };
    const quantidade = linhas[block.tamanho ?? 'medio'] ?? 8;
    for (let linha = 0; linha < quantidade; linha += 1) {
      const y = inicio + linha * 17;
      documento.moveTo(x, y).lineTo(x + largura, y).lineWidth(0.4).strokeColor('#aaaaaa').stroke();
    }
    documento.y = inicio + quantidade * 17 + 10;
    return;
  }

  if (!question) throw erroDeConteudo('Uma questão da prova não pôde ser carregada.');
  const larguraDaQuestao = largura - 24;
  const larguraDosPontos = 56;
  const larguraDoEnunciado = larguraDaQuestao - larguraDosPontos - 8;
  documento.font('Helvetica-Bold').fontSize(10).fillColor('#111111')
    .text(`${bloco.number}.`, x, inicio, { width: 20 });
  documento.font('Helvetica').fontSize(10).fillColor('#111111')
    .text(textoMarkdown(question.statement), x + 24, inicio, {
      width: larguraDoEnunciado,
      lineGap: 2,
    });
  documento.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
    .text(`${question.score} pts`, x + largura - larguraDosPontos, inicio, {
      width: larguraDosPontos,
      align: 'right',
    });
  const alturaDoEnunciado = alturaDeTexto(
    documento,
    textoMarkdown(question.statement),
    larguraDoEnunciado,
    10,
  );
  documento.y = inicio + Math.max(alturaDoEnunciado, 12) + 5;

  if (question.type === 'objetiva') {
    (alternatives ?? []).forEach((alternativa, indice) => {
      const y = documento.y;
      documento.circle(x + 30, y + 5, 4).lineWidth(0.7).strokeColor('#555555').stroke();
      documento.font('Helvetica-Bold').fontSize(9).fillColor('#111111')
        .text(`${LETTERS[indice]})`, x + 42, y, { width: 20 });
      documento.font('Helvetica').fontSize(9).fillColor('#111111')
        .text(textoMarkdown(alternativa.text), x + 62, y, { width: larguraDaQuestao - 38, lineGap: 2 });
      documento.y += Math.max(14, documento.y - y) + 3;
    });
  } else {
    const linhas = bloco.block.formatoResposta === 'longa' ? 8 : 4;
    const altura = linhas * 17;
    for (let linha = 0; linha < linhas; linha += 1) {
      const y = documento.y + linha * 17 + 15;
      documento.moveTo(x + 24, y).lineTo(x + largura, y).lineWidth(0.4).strokeColor('#aaaaaa').stroke();
    }
    documento.y += altura + 6;
  }
  documento.y += 10;
}

function desenharFolhaDeRespostas(
  documento: PDFKit.PDFDocument,
  dados: DadosPdfAplicacao,
  versao: VersaoPdf,
  qr: Buffer,
  estudante?: AtribuicaoPdf,
  questoesObjetivas: Array<{ numero: number; alternativas: number }> = [],
): void {
  documento.addPage({ size: 'A4', margin: 0 });
  desenharMarcadoresDaFolha(documento);
  documento.font('Helvetica-Bold').fontSize(16).fillColor('#111111')
    .text('Cartão-resposta', pontos(23), pontos(23), { width: pontos(125) });
  documento.font('Helvetica').fontSize(10).fillColor('#111111')
    .text(`${dados.title} · Versão ${versao.versionNumber}`, pontos(23), pontos(33), {
      width: pontos(130),
    });
  documento.font('Helvetica').fontSize(9).fillColor('#222222')
    .text(`Turma: ${dados.className} · ${dados.subject}`, pontos(23), pontos(41), {
      width: pontos(130),
    });
  if (estudante) {
    documento.font('Helvetica-Bold').fontSize(10).fillColor('#111111')
      .text(`Estudante: ${estudante.fullName}`, pontos(23), pontos(49), { width: pontos(130) });
    if (dados.header.campos.matricula && estudante.registration) {
      documento.font('Helvetica').fontSize(9).fillColor('#222222')
        .text(`Matrícula: ${estudante.registration}`, pontos(23), pontos(57), {
          width: pontos(130),
        });
    }
  } else {
    documento.font('Helvetica').fontSize(9).fillColor('#222222')
      .text('Nome: ____________________________________', pontos(23), pontos(49), {
        width: pontos(130),
      });
  }
  documento.image(qr, pontos(163), pontos(21), { width: pontos(27), height: pontos(27) });
  documento.font('Helvetica').fontSize(8).fillColor('#333333')
    .text('Preencha uma bolha por questão.', pontos(23), pontos(65), { width: pontos(150) });

  const centrosColuna = [35, 120];
  for (let coluna = 0; coluna < 2; coluna += 1) {
    for (let opcao = 0; opcao < LETTERS.length; opcao += 1) {
      const x = pontos(centrosColuna[coluna] + opcao * 10);
      documento.font('Helvetica-Bold').fontSize(8).fillColor('#222222')
        .text(LETTERS[opcao], x - pontos(2), pontos(72), { width: pontos(4), align: 'center' });
    }
  }

  questoesObjetivas.forEach((questao, indice) => {
    const coluna = Math.floor(indice / 10);
    const linha = indice % 10;
    const centroX = centrosColuna[coluna];
    const centroY = 80 + linha * 18;
    documento.font('Helvetica-Bold').fontSize(9).fillColor('#111111')
      .text(String(questao.numero), pontos(centroX - 18), pontos(centroY - 4), {
        width: pontos(10),
        align: 'right',
      });
    for (let opcao = 0; opcao < questao.alternativas; opcao += 1) {
      documento.circle(pontos(centroX + opcao * 10), pontos(centroY), pontos(3))
        .lineWidth(0.7)
        .strokeColor('#111111')
        .fillColor('#ffffff')
        .fillAndStroke();
    }
  });

  documento.font('Helvetica').fontSize(8).fillColor('#333333')
    .text('Não dobre, rasure ou marque fora dos círculos.', pontos(23), pontos(258), {
      width: pontos(165),
    });
  documento.font('Helvetica').fontSize(8).fillColor('#555555')
    .text('Layout provisório; validar com impressão e fotos reais antes de uso operacional.', pontos(23), pontos(266), {
      width: pontos(165),
    });
}

async function qrEmPng(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    type: 'png',
    errorCorrectionLevel: 'Q',
    margin: 1,
    scale: 8,
  });
}

function validarCartao(questoesObjetivas: Array<{ numero: number; alternativas: number }>): void {
  if (questoesObjetivas.length > 20) {
    throw erroDeConteudo('O cartão-resposta provisório comporta até 20 questões objetivas.');
  }
  if (questoesObjetivas.some((questao) => questao.alternativas < 2 || questao.alternativas > 5)) {
    throw erroDeConteudo(
      'O cartão-resposta provisório aceita de duas a cinco alternativas por questão objetiva.',
    );
  }
}

export async function gerarPdfConsolidado(dados: DadosPdfAplicacao): Promise<Buffer> {
  if (dados.versions.length === 0) {
    throw erroDeConteudo('Gere ao menos uma versão antes de criar o PDF.');
  }

  const documento = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false });
  const partes: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    documento.on('data', (parte: Uint8Array) => partes.push(Buffer.from(parte)));
    documento.on('error', reject);
    documento.on('end', () => resolve(Buffer.concat(partes)));

    void (async () => {
      try {
        for (const versao of dados.versions) {
          const alternativasPorQuestao = new Map(
            versao.layout.alternativeOrder.map((item) => [item.questionId, item.printedOrder]),
          );
          const blocos = criarBlocosImprimiveis(
            dados.blocks,
            dados.questions,
            versao.layout.questionOrder,
            alternativasPorQuestao,
          );

          const copias: Array<{ qrCodePayload: string; estudante?: AtribuicaoPdf }> =
            versao.assignments.length > 0
              ? versao.assignments.map((estudante) => ({
                  qrCodePayload: estudante.qrCodePayload,
                  estudante,
                }))
              : [{ qrCodePayload: versao.qrCodePayload }];

          for (const copia of copias) {
            const qr = await qrEmPng(copia.qrCodePayload);
            let pagina = 0;
            const questoesObjetivas: Array<{ numero: number; alternativas: number }> = [];
            const iniciarPagina = (primeira: boolean) => {
              documento.addPage({ size: 'A4', margin: 0 });
              pagina += 1;
              documento.fillColor('#111111');
              const topo = primeira
                ? desenharCabecalho(documento, dados, versao.versionNumber, qr, copia.estudante)
                : MARGIN + 38;
              if (!primeira) {
                documento.font('Helvetica-Bold').fontSize(10).fillColor('#111111')
                  .text(`${dados.title} · Versão ${versao.versionNumber}`, MARGIN, MARGIN, {
                    width: PAGE_WIDTH - MARGIN * 2 - 70,
                  });
                documento.font('Helvetica').fontSize(8).fillColor('#555555')
                  .text(copia.estudante?.fullName ?? '', MARGIN, MARGIN + 14, {
                    width: PAGE_WIDTH - MARGIN * 2 - 70,
                  });
              }
              adicionarRodape(documento, versao.versionNumber, pagina, copia.estudante?.fullName);
              documento.y = topo;
            };

            iniciarPagina(true);
            for (const bloco of blocos) {
              const altura = alturaDoBloco(documento, bloco, PAGE_WIDTH - MARGIN * 2);
              if (altura === 0) continue;
              const limite = BOTTOM - documento.y;
              if (altura > limite) {
                if (altura > BOTTOM - MARGIN - 60) {
                  throw erroDeConteudo(
                    `Um bloco da prova excede a área útil de uma folha A4${bloco.number ? ` (questão ${bloco.number})` : ''}. Reduza o conteúdo antes de gerar.`,
                  );
                }
                iniciarPagina(false);
              }
              if (bloco.type === 'questao' && bloco.question?.type === 'objetiva') {
                questoesObjetivas.push({
                  numero: bloco.number ?? questoesObjetivas.length + 1,
                  alternativas: bloco.alternatives?.length ?? 0,
                });
              }
              desenharBloco(documento, bloco, MARGIN, PAGE_WIDTH - MARGIN * 2);
            }

            validarCartao(questoesObjetivas);
            if (questoesObjetivas.length > 0) {
              desenharFolhaDeRespostas(
                documento,
                dados,
                versao,
                qr,
                copia.estudante,
                questoesObjetivas,
              );
            }
          }
        }
        documento.end();
      } catch (erro) {
        documento.destroy(erro instanceof Error ? erro : undefined);
        reject(erro);
      }
    })();
  });
}
