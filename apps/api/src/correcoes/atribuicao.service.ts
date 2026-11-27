import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Correcao } from '@sgp/shared-types';
import { ehViolacaoDeUnicidade } from '../prisma/erros';
import { PrismaService } from '../prisma/prisma.service';
import type { AtribuirCorrecaoDto } from './correcoes.dto';
import { paraCorrecao } from './mapeadores';

const MENSAGEM_DE_DUPLICIDADE = 'O estudante ja tem uma correcao nesta versao da prova.';

/**
 * Lancamento manual de nota (RF09): a correcao de prova sem identificacao chega sem
 * estudante, e o professor a atribui depois. Atribuir preenche a correcao existente, nunca
 * cria outra, e uma versao nao aceita duas correcoes do mesmo estudante.
 */
@Injectable()
export class AtribuicaoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Todas as correcoes das aplicacoes do professor, atribuidas ou nao. */
  async listar(professorId: string): Promise<Correcao[]> {
    const correcoes = await this.prisma.correcao.findMany({
      where: { versao: { aplicacao: { teacherId: professorId } } },
      orderBy: [{ confirmedAt: 'asc' }, { id: 'asc' }],
    });
    return correcoes.map(paraCorrecao);
  }

  /** Correcoes ainda sem estudante de uma aplicacao do professor. */
  async listarPendentes(professorId: string, applicationId: string): Promise<Correcao[]> {
    const aplicacao = await this.prisma.aplicacao.findFirst({
      where: { id: applicationId, teacherId: professorId },
      select: { id: true },
    });
    if (!aplicacao) throw new NotFoundException('Aplicacao nao encontrada.');

    const correcoes = await this.prisma.correcao.findMany({
      where: { studentId: null, versao: { applicationId } },
      orderBy: [{ confirmedAt: 'asc' }, { id: 'asc' }],
    });
    return correcoes.map(paraCorrecao);
  }

  /**
   * O estudante precisa estar matriculado na turma da aplicacao: o candidato e quem fez a
   * prova naquela turma, nunca a base inteira de estudantes.
   */
  async atribuir(professorId: string, id: string, dados: AtribuirCorrecaoDto): Promise<Correcao> {
    const correcao = await this.correcaoDoProfessor(professorId, id);
    if (correcao.studentId !== null) {
      throw new ConflictException('A correcao ja esta atribuida a um estudante.');
    }

    const matricula = await this.prisma.matricula.findFirst({
      where: {
        classId: correcao.versao.aplicacao.classId,
        studentId: dados.studentId,
        status: 'active',
      },
      select: { id: true },
    });
    if (!matricula) {
      throw new BadRequestException('O estudante nao tem matricula ativa na turma da aplicacao.');
    }

    const outra = await this.prisma.correcao.findFirst({
      where: { examVersionId: correcao.examVersionId, studentId: dados.studentId },
      select: { id: true },
    });
    if (outra) throw new ConflictException(MENSAGEM_DE_DUPLICIDADE);

    try {
      const atualizada = await this.prisma.correcao.update({
        where: { id },
        data: {
          studentId: dados.studentId,
          ...(dados.notes !== undefined ? { notes: dados.notes } : {}),
        },
      });
      return paraCorrecao(atualizada);
    } catch (erro) {
      // Outra atribuicao gravou o mesmo estudante nesta versao no meio do caminho.
      if (ehViolacaoDeUnicidade(erro)) throw new ConflictException(MENSAGEM_DE_DUPLICIDADE);
      throw erro;
    }
  }

  /**
   * Desfaz uma atribuicao manual, para corrigir um estudante escolhido por engano. A
   * correcao atribuida pelo QR Code (`isAutomaticallyAssigned`) nao volta para a fila.
   */
  async desfazerAtribuicao(professorId: string, id: string): Promise<Correcao> {
    const correcao = await this.correcaoDoProfessor(professorId, id);
    if (correcao.isAutomaticallyAssigned) {
      throw new ConflictException('A correcao veio de prova com identificacao e nao volta a fila.');
    }
    if (correcao.studentId === null) return paraCorrecao(correcao);

    const atualizada = await this.prisma.correcao.update({
      where: { id },
      data: { studentId: null },
    });
    return paraCorrecao(atualizada);
  }

  private async correcaoDoProfessor(professorId: string, id: string) {
    const correcao = await this.prisma.correcao.findFirst({
      where: { id, versao: { aplicacao: { teacherId: professorId } } },
      include: { versao: { select: { aplicacao: { select: { classId: true } } } } },
    });
    if (!correcao) throw new NotFoundException('Correcao nao encontrada.');
    return correcao;
  }
}
