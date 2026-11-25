import { randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AtribuicaoVersao, Aplicacao, LayoutVersao, VersaoProva } from '@sgp/shared-types';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PROFESSOR_ATUAL_ID } from '../professor-atual';
import type { CabecalhoPdfDto, GerarPdfDto, GerarVersoesDto } from './aplicacoes.dto';
import { criarLayoutVersao, distribuirEstudantes } from './geracao.util';
import { paraAplicacao } from './mapeadores';
import {
  gerarPdfConsolidado,
  type BlocoParaPdf,
  type CabecalhoPdf,
} from './pdf-gerador';

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

@Injectable()
export class AplicacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<Aplicacao[]> {
    const aplicacoes = await this.prisma.aplicacao.findMany({
      where: { teacherId: PROFESSOR_ATUAL_ID },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return aplicacoes.map(paraAplicacao);
  }

  async obter(id: string): Promise<Aplicacao> {
    const aplicacao = await this.prisma.aplicacao.findFirst({
      where: { id, teacherId: PROFESSOR_ATUAL_ID },
    });
    if (!aplicacao) throw new NotFoundException('Aplicacao nao encontrada.');
    return paraAplicacao(aplicacao);
  }

  async criar(dados: { examId: string; classId: string }): Promise<Aplicacao> {
    return this.prisma.$transaction(async (tx) => {
      const prova = await tx.prova.findFirst({
        where: { id: dados.examId, teacherId: PROFESSOR_ATUAL_ID },
        select: { id: true, status: true },
      });
      if (!prova) throw new NotFoundException('Prova nao encontrada.');
      if (prova.status === 'closed') {
        throw new ConflictException('Prova encerrada nao aceita novas aplicacoes.');
      }

      const turma = await tx.turma.findFirst({
        where: { id: dados.classId, teacherId: PROFESSOR_ATUAL_ID },
        select: { id: true },
      });
      if (!turma) throw new NotFoundException('Turma nao encontrada.');

      const atualizada = await tx.prova.updateMany({
        where: {
          id: dados.examId,
          teacherId: PROFESSOR_ATUAL_ID,
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
          teacherId: PROFESSOR_ATUAL_ID,
        },
      });
      return paraAplicacao(aplicacao);
    });
  }

  async gerarVersoes(id: string, dados: GerarVersoesDto): Promise<ResultadoGeracao> {
    return this.prisma.$transaction((tx) =>
      this.gerarVersoesEmTransacao(tx, id, dados, true),
    );
  }

  async gerarPdf(id: string, dados: GerarPdfDto): Promise<ResultadoGeracaoPdf> {
    return this.prisma.$transaction(
      async (tx) => {
        const geracao = await this.gerarVersoesEmTransacao(tx, id, dados, false);
        const aplicacao = await tx.aplicacao.findFirst({
          where: { id, teacherId: PROFESSOR_ATUAL_ID },
          select: { id: true, examId: true, classId: true },
        });
        if (!aplicacao) throw new NotFoundException('Aplicacao nao encontrada.');

        const prova = await tx.prova.findFirst({
          where: { id: aplicacao.examId, teacherId: PROFESSOR_ATUAL_ID },
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
          where: { id: aplicacao.classId, teacherId: PROFESSOR_ATUAL_ID },
          select: { name: true, subject: true },
        });
        if (!turma) throw new NotFoundException('Turma nao encontrada.');

        const professor = await tx.usuario.findFirst({
          where: { id: PROFESSOR_ATUAL_ID, role: 'professor' },
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
        const cabecalho = dados.cabecalho
          ? copiarCabecalho(dados.cabecalho)
          : cabecalhoPadrao(professor.fullName);
        const pdf = await gerarPdfConsolidado({
          title: prova.title,
          description: prova.description,
          totalScore: prova.questoes.reduce(
            (total, questao) => total + Number(questao.score),
            0,
          ),
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

  async obterPdf(id: string): Promise<Buffer> {
    const aplicacao = await this.prisma.aplicacao.findFirst({
      where: { id, teacherId: PROFESSOR_ATUAL_ID },
      select: { pdfContent: true },
    });
    if (!aplicacao) throw new NotFoundException('Aplicacao nao encontrada.');
    if (!aplicacao.pdfContent) throw new NotFoundException('PDF ainda nao foi gerado.');
    return Buffer.from(aplicacao.pdfContent);
  }

  private async gerarVersoesEmTransacao(
    tx: Prisma.TransactionClient,
    id: string,
    dados: GerarVersoesDto,
    invalidarPdfAoRegenerar: boolean,
  ): Promise<ResultadoGeracao> {
    const aplicacao = await tx.aplicacao.findFirst({
      where: { id, teacherId: PROFESSOR_ATUAL_ID },
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
      where: { id: aplicacao.examId, teacherId: PROFESSOR_ATUAL_ID },
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
}
