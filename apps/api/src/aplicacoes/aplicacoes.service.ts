import { randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AtribuicaoVersao,
  Aplicacao,
  GabaritoVersaoSnapshot,
  LayoutVersao,
  StatusAplicacao,
  VersaoProva,
} from '@sgp/shared-types';
import { GabaritoIndisponivelError } from '../correcoes/gabarito';
import {
  gabaritoDaVersao,
  incluirProvaParaGabarito,
  questoesParaGabarito,
} from '../correcoes/gabarito-do-banco';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CabecalhoPdfDto, GerarPdfDto, GerarVersoesDto } from './aplicacoes.dto';
import { criarLayoutVersao, distribuirEstudantes } from './geracao.util';
import { paraAplicacao } from './mapeadores';
import { gerarPdfConsolidado, type BlocoParaPdf, type CabecalhoPdf } from './pdf-gerador';

export interface ResultadoGeracao {
  versions: VersaoProva[];
  assignments: AtribuicaoVersao[];
}

export interface ResultadoGeracaoPdf extends ResultadoGeracao {
  application: Aplicacao;
}

function blocosParaPdf(valor: Prisma.JsonValue | null): BlocoParaPdf[] | null {
  if (valor === null) return null;
  if (!Array.isArray(valor)) {
    throw new BadRequestException('O layout da prova esta invalido. Salve a prova novamente.');
  }

  return valor.map((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new BadRequestException('O layout da prova contem um bloco invalido.');
    }
    return {
      type: typeof item.type === 'string' ? item.type : '',
      ...(typeof item.questionId === 'string' ? { questionId: item.questionId } : {}),
      ...(typeof item.titulo === 'string' ? { titulo: item.titulo } : {}),
      ...(typeof item.descricao === 'string' ? { descricao: item.descricao } : {}),
      ...(typeof item.conteudo === 'string' ? { conteudo: item.conteudo } : {}),
      ...(typeof item.estilo === 'string' ? { estilo: item.estilo } : {}),
      ...(typeof item.url === 'string' ? { url: item.url } : {}),
      ...(typeof item.legenda === 'string' ? { legenda: item.legenda } : {}),
      ...(typeof item.tamanho === 'string' ? { tamanho: item.tamanho } : {}),
      ...(typeof item.formatoResposta === 'string'
        ? { formatoResposta: item.formatoResposta }
        : {}),
    };
  });
}

function cabecalhoPadrao(professor: string): CabecalhoPdf {
  return {
    instituicao: 'Catolica de Santa Catarina',
    linhaComplementar: '',
    professor,
    instrucoes: '',
    campos: { nome: true, matricula: false, turma: true, data: true, nota: true },
  };
}

function copiarCabecalho(cabecalho: CabecalhoPdfDto): CabecalhoPdf {
  return {
    instituicao: cabecalho.instituicao,
    linhaComplementar: cabecalho.linhaComplementar,
    professor: cabecalho.professor,
    instrucoes: cabecalho.instrucoes,
    campos: {
      nome: cabecalho.campos.nome,
      matricula: cabecalho.campos.matricula,
      turma: cabecalho.campos.turma,
      data: cabecalho.campos.data,
      nota: cabecalho.campos.nota,
    },
  };
}

function lerLayoutVersao(valor: Prisma.JsonValue): LayoutVersao {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new BadRequestException('O layout da versão está inválido.');
  }
  const questionOrder = valor.questionOrder;
  const alternativeOrder = valor.alternativeOrder;
  if (
    !Array.isArray(questionOrder) ||
    !questionOrder.every((id): id is string => typeof id === 'string') ||
    !Array.isArray(alternativeOrder)
  ) {
    throw new BadRequestException('O layout da versão está inválido.');
  }
  const alternativas = alternativeOrder.map((item) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      Array.isArray(item) ||
      typeof item.questionId !== 'string' ||
      !Array.isArray(item.printedOrder) ||
      !item.printedOrder.every((id): id is string => typeof id === 'string')
    ) {
      throw new BadRequestException('A ordem das alternativas da versão está inválida.');
    }
    return { questionId: item.questionId, printedOrder: item.printedOrder };
  });
  return { questionOrder, alternativeOrder: alternativas };
}

/**
 * Aplicacao com o que a lista do aplicativo mostra (RF08): titulo da prova, turma e, por
 * versao, quantas provas foram atribuidas e quantas ja tem correcao. Prova sem
 * identificacao nao tem atribuicao, entao o total impresso dela e desconhecido.
 */
export interface AplicacaoParaCorrigir {
  id: string;
  examId: string;
  classId: string;
  status: StatusAplicacao;
  createdAt: string;
  examTitle: string;
  className: string;
  subject: string;
  versions: {
    id: string;
    versionNumber: number;
    withStudentIdentification: boolean;
    assignmentCount: number;
    correctionCount: number;
  }[];
}

@Injectable()
export class AplicacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(professorId: string): Promise<Aplicacao[]> {
    const aplicacoes = await this.prisma.aplicacao.findMany({
      where: { teacherId: professorId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return aplicacoes.map(paraAplicacao);
  }

  async obter(professorId: string, id: string): Promise<Aplicacao> {
    const aplicacao = await this.prisma.aplicacao.findFirst({
      where: { id, teacherId: professorId },
    });
    if (!aplicacao) throw new NotFoundException('Aplicacao nao encontrada.');
    return paraAplicacao(aplicacao);
  }

  async criar(professorId: string, dados: { examId: string; classId: string }): Promise<Aplicacao> {
    return this.prisma.$transaction(async (tx) => {
      const prova = await tx.prova.findFirst({
        where: { id: dados.examId, teacherId: professorId },
        select: { id: true, status: true },
      });
      if (!prova) throw new NotFoundException('Prova nao encontrada.');
      if (prova.status === 'closed') {
        throw new ConflictException('Prova encerrada nao aceita novas aplicacoes.');
      }

      const turma = await tx.turma.findFirst({
        where: { id: dados.classId, teacherId: professorId },
        select: { id: true },
      });
      if (!turma) throw new NotFoundException('Turma nao encontrada.');

      const atualizada = await tx.prova.updateMany({
        where: {
          id: dados.examId,
          teacherId: professorId,
          status: { not: 'closed' },
        },
        data: { status: 'ready' },
      });
      if (atualizada.count !== 1) {
        throw new ConflictException('Prova encerrada nao aceita novas aplicacoes.');
      }

      const aplicacao = await tx.aplicacao.create({
        data: {
          examId: dados.examId,
          classId: dados.classId,
          teacherId: professorId,
        },
      });
      return paraAplicacao(aplicacao);
    });
  }

  async gerarVersoes(
    professorId: string,
    id: string,
    dados: GerarVersoesDto,
  ): Promise<ResultadoGeracao> {
    return this.prisma.$transaction((tx) =>
      this.gerarVersoesEmTransacao(tx, professorId, id, dados, true),
    );
  }

  async gerarPdf(
    professorId: string,
    id: string,
    dados: GerarPdfDto,
  ): Promise<ResultadoGeracaoPdf> {
    return this.prisma.$transaction(
      async (tx) => {
        const geracao = await this.gerarVersoesEmTransacao(tx, professorId, id, dados, false);
        const pdf = await this.renderizarPdf(tx, professorId, id, dados.cabecalho);
        const pdfUrl = `/aplicacoes/${id}/pdf`;
        const atualizada = await tx.aplicacao.update({
          where: { id },
          data: { status: 'generated', pdfUrl, pdfContent: Uint8Array.from(pdf) },
        });

        return {
          application: paraAplicacao(atualizada),
          ...geracao,
        };
      },
      { timeout: 60_000 },
    );
  }

  /** Monta o PDF consolidado a partir das versoes que a aplicacao ja tem no banco. */
  private async renderizarPdf(
    tx: Prisma.TransactionClient,
    professorId: string,
    id: string,
    cabecalhoDto: CabecalhoPdfDto | undefined,
  ): Promise<Buffer> {
    const aplicacao = await tx.aplicacao.findFirst({
      where: { id, teacherId: professorId },
      select: { id: true, examId: true, classId: true },
    });
    if (!aplicacao) throw new NotFoundException('Aplicacao nao encontrada.');

    const prova = await tx.prova.findFirst({
      where: { id: aplicacao.examId, teacherId: professorId },
      select: {
        title: true,
        description: true,
        blocos: true,
        questoes: {
          orderBy: [{ order: 'asc' }, { questionId: 'asc' }],
          select: {
            questionId: true,
            score: true,
            questao: {
              select: {
                id: true,
                type: true,
                statement: true,
                alternativas: {
                  orderBy: [{ position: 'asc' }, { id: 'asc' }],
                  select: { id: true, text: true },
                },
              },
            },
          },
        },
      },
    });
    if (!prova) throw new NotFoundException('Prova nao encontrada.');

    const turma = await tx.turma.findFirst({
      where: { id: aplicacao.classId, teacherId: professorId },
      select: { name: true, subject: true },
    });
    if (!turma) throw new NotFoundException('Turma nao encontrada.');

    const professor = await tx.usuario.findFirst({
      where: { id: professorId, role: 'professor' },
      select: { fullName: true },
    });
    if (!professor) throw new NotFoundException('Professor nao encontrado.');

    const versoesDoBanco = await tx.versaoProva.findMany({
      where: { applicationId: id },
      orderBy: { versionNumber: 'asc' },
      include: {
        atribuicoes: {
          orderBy: { studentId: 'asc' },
          include: {
            estudante: { select: { id: true, fullName: true, registration: true } },
          },
        },
      },
    });
    const cabecalho = cabecalhoDto
      ? copiarCabecalho(cabecalhoDto)
      : cabecalhoPadrao(professor.fullName);
    const pdf = await gerarPdfConsolidado({
      title: prova.title,
      description: prova.description,
      totalScore: prova.questoes.reduce((total, questao) => total + Number(questao.score), 0),
      blocks: blocosParaPdf(prova.blocos),
      questions: prova.questoes.map(({ questao, score }) => ({
        id: questao.id,
        type: questao.type,
        statement: questao.statement,
        score: score.toString(),
        alternatives: questao.alternativas,
      })),
      className: turma.name,
      subject: turma.subject,
      header: cabecalho,
      versions: versoesDoBanco.map((versao) => ({
        versionNumber: versao.versionNumber,
        qrCodePayload: versao.qrCodePayload,
        layout: lerLayoutVersao(versao.layout),
        assignments: versao.atribuicoes.map((atribuicao) => ({
          studentId: atribuicao.estudante.id,
          fullName: atribuicao.estudante.fullName,
          registration: atribuicao.estudante.registration,
          qrCodePayload: atribuicao.qrCodePayload,
        })),
      })),
    });
    return pdf;
  }

  async obterPdf(professorId: string, id: string): Promise<Buffer> {
    const aplicacao = await this.prisma.aplicacao.findFirst({
      where: { id, teacherId: professorId },
      select: { pdfContent: true },
    });
    if (!aplicacao) throw new NotFoundException('Aplicacao nao encontrada.');
    if (aplicacao.pdfContent) return Buffer.from(aplicacao.pdfContent);

    // Aplicacao gerada antes de o PDF ser gravado (ex.: dados de demonstracao do seed): monta
    // o arquivo das versoes existentes, sem regerar nada, e guarda para os proximos downloads.
    return this.prisma.$transaction(
      async (tx) => {
        const versoes = await tx.versaoProva.count({ where: { applicationId: id } });
        if (versoes === 0) throw new NotFoundException('PDF ainda nao foi gerado.');
        const pdf = await this.renderizarPdf(tx, professorId, id, undefined);
        await tx.aplicacao.update({
          where: { id },
          data: { pdfUrl: `/aplicacoes/${id}/pdf`, pdfContent: Uint8Array.from(pdf) },
        });
        return pdf;
      },
      { timeout: 60_000 },
    );
  }

  private async gerarVersoesEmTransacao(
    tx: Prisma.TransactionClient,
    professorId: string,
    id: string,
    dados: GerarVersoesDto,
    invalidarPdfAoRegenerar: boolean,
  ): Promise<ResultadoGeracao> {
    const aplicacao = await tx.aplicacao.findFirst({
      where: { id, teacherId: professorId },
      select: { id: true, examId: true, classId: true, status: true },
    });
    if (!aplicacao) throw new NotFoundException('Aplicacao nao encontrada.');
    if (aplicacao.status === 'closed') {
      throw new ConflictException('Aplicacao encerrada nao pode gerar versoes.');
    }

    const versoesExistentes = await tx.versaoProva.findMany({
      where: { applicationId: id },
      select: { id: true },
    });
    if (versoesExistentes.length > 0) {
      const correcoes = await tx.correcao.count({
        where: { examVersionId: { in: versoesExistentes.map((versao) => versao.id) } },
      });
      if (correcoes > 0) {
        throw new ConflictException(
          'Nao e possivel regenerar apos uma correcao confirmada. Crie uma nova aplicacao.',
        );
      }
    }

    const prova = await tx.prova.findFirst({
      where: { id: aplicacao.examId, teacherId: professorId },
      select: {
        questoes: {
          orderBy: [{ order: 'asc' }, { questionId: 'asc' }],
          select: {
            questionId: true,
            questao: {
              select: {
                type: true,
                alternativas: {
                  orderBy: [{ position: 'asc' }, { id: 'asc' }],
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
    if (!prova) throw new NotFoundException('Prova nao encontrada.');

    const matriculas = dados.withStudentIdentification
      ? await tx.matricula.findMany({
          where: { classId: aplicacao.classId, status: 'active' },
          orderBy: [{ enrolledAt: 'asc' }, { id: 'asc' }],
          select: { studentId: true },
        })
      : [];
    if (dados.withStudentIdentification && matriculas.length === 0) {
      throw new BadRequestException(
        'A turma precisa ter ao menos um estudante matriculado para gerar provas identificadas.',
      );
    }

    const questoes = prova.questoes.map(({ questionId, questao }) => ({
      questionId,
      type: questao.type,
      alternativeIds: questao.alternativas.map((alternativa) => alternativa.id),
    }));
    const idsDasVersoes = Array.from({ length: dados.quantity }, () => randomUUID());
    const distribuicao = dados.withStudentIdentification
      ? distribuirEstudantes(
          matriculas.map((matricula) => matricula.studentId),
          idsDasVersoes,
        )
      : [];
    const atribuicoes = distribuicao.map(({ studentId, examVersionId }) => ({
      id: randomUUID(),
      examVersionId,
      studentId,
      qrCodePayload: `sgp:v1:version:${examVersionId}:student:${studentId}`,
    }));

    if (versoesExistentes.length > 0) {
      await tx.versaoProva.deleteMany({ where: { applicationId: id } });
    }

    const versoes: VersaoProva[] = [];
    for (let indice = 0; indice < dados.quantity; indice += 1) {
      const examVersionId = idsDasVersoes[indice];
      const layout: LayoutVersao = criarLayoutVersao(
        questoes,
        dados.shuffleQuestions,
        dados.shuffleAlternatives,
      );
      const publicCode = `GAB-${randomBytes(10).toString('hex').toUpperCase()}`;
      const qrCodePayload = `sgp:v1:version:${examVersionId}`;
      const versao = await tx.versaoProva.create({
        data: {
          id: examVersionId,
          applicationId: id,
          versionNumber: indice + 1,
          shuffleQuestions: dados.shuffleQuestions,
          shuffleAlternatives: dados.shuffleAlternatives,
          withStudentIdentification: dados.withStudentIdentification,
          layout: {
            questionOrder: [...layout.questionOrder],
            alternativeOrder: layout.alternativeOrder.map((item) => ({
              questionId: item.questionId,
              printedOrder: [...item.printedOrder],
            })),
          },
          publicCode,
          qrCodePayload,
        },
      });
      versoes.push({
        id: versao.id,
        applicationId: versao.applicationId,
        versionNumber: versao.versionNumber,
        shuffleQuestions: versao.shuffleQuestions,
        shuffleAlternatives: versao.shuffleAlternatives,
        withStudentIdentification: versao.withStudentIdentification,
        layout,
        answerKeyPublished: versao.answerKeyPublished,
        publicCode: versao.publicCode,
        qrCodePayload: versao.qrCodePayload,
        createdAt: versao.createdAt.toISOString(),
        ...(versao.answerKeyPublishedAt
          ? { answerKeyPublishedAt: versao.answerKeyPublishedAt.toISOString() }
          : {}),
      });
    }

    if (atribuicoes.length > 0) {
      await tx.atribuicaoVersao.createMany({ data: atribuicoes });
    }

    if (invalidarPdfAoRegenerar && aplicacao.status === 'generated') {
      await tx.aplicacao.update({
        where: { id },
        data: { status: 'draft', pdfUrl: null, pdfContent: null },
      });
    }

    return { versions: versoes, assignments: atribuicoes };
  }

  /** So as geradas existem em papel para corrigir. */
  async listarParaCorrigir(professorId: string): Promise<AplicacaoParaCorrigir[]> {
    const aplicacoes = await this.prisma.aplicacao.findMany({
      where: { teacherId: professorId, status: 'generated' },
      include: {
        prova: { select: { title: true } },
        turma: { select: { name: true, subject: true } },
        versoes: {
          orderBy: { versionNumber: 'asc' },
          select: {
            id: true,
            versionNumber: true,
            withStudentIdentification: true,
            _count: { select: { atribuicoes: true, correcoes: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });

    return aplicacoes.map((aplicacao) => ({
      id: aplicacao.id,
      examId: aplicacao.examId,
      classId: aplicacao.classId,
      status: aplicacao.status,
      createdAt: aplicacao.createdAt.toISOString(),
      examTitle: aplicacao.prova.title,
      className: aplicacao.turma.name,
      subject: aplicacao.turma.subject,
      versions: aplicacao.versoes.map((versao) => ({
        id: versao.id,
        versionNumber: versao.versionNumber,
        withStudentIdentification: versao.withStudentIdentification,
        assignmentCount: versao._count.atribuicoes,
        correctionCount: versao._count.correcoes,
      })),
    }));
  }

  /**
   * Gabarito oficial de todas as versoes, baixado ao abrir a aplicacao para corrigir sem
   * sinal (RF08). `capturedAt` e o momento desta resposta: o aplicativo guarda a copia
   * mais recente de cada versao.
   */
  async gabaritos(professorId: string, applicationId: string): Promise<GabaritoVersaoSnapshot[]> {
    const aplicacao = await this.prisma.aplicacao.findFirst({
      where: { id: applicationId, teacherId: professorId },
      include: {
        prova: { include: incluirProvaParaGabarito },
        versoes: { orderBy: { versionNumber: 'asc' } },
      },
    });
    if (!aplicacao) throw new NotFoundException('Aplicacao nao encontrada.');

    const questoes = questoesParaGabarito(aplicacao.prova);
    const agora = new Date();
    try {
      return aplicacao.versoes.map((versao) => gabaritoDaVersao(versao, questoes, agora));
    } catch (erro) {
      if (erro instanceof GabaritoIndisponivelError) throw new ConflictException(erro.message);
      throw erro;
    }
  }
}
