import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { GabaritoVersaoSnapshot, StatusAplicacao } from '@sgp/shared-types';
import { GabaritoIndisponivelError } from '../correcoes/gabarito';
import {
  gabaritoDaVersao,
  incluirProvaParaGabarito,
  questoesParaGabarito,
} from '../correcoes/gabarito-do-banco';
import { PrismaService } from '../prisma/prisma.service';

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
