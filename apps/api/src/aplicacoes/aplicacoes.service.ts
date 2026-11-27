import { randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AtribuicaoVersao, Aplicacao, LayoutVersao, VersaoProva } from '@sgp/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import type { GerarVersoesDto } from './aplicacoes.dto';
import { criarLayoutVersao, distribuirEstudantes } from './geracao.util';
import { paraAplicacao } from './mapeadores';

export interface ResultadoGeracao {
  versions: VersaoProva[];
  assignments: AtribuicaoVersao[];
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
    return this.prisma.$transaction(async (tx) => {
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
      const atribuicoes = distribuicao.map(({ studentId, examVersionId }) => {
        return {
          id: randomUUID(),
          examVersionId,
          studentId,
          qrCodePayload: `sgp:v1:version:${examVersionId}:student:${studentId}`,
        };
      });

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

      if (aplicacao.status === 'generated') {
        await tx.aplicacao.update({
          where: { id },
          data: { status: 'draft', pdfUrl: null },
        });
      }

      return {
        versions: versoes,
        assignments: atribuicoes,
      };
    });
  }
}
