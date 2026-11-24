import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Matricula, Turma } from '@sgp/shared-types';
import { ehViolacaoDeUnicidade } from '../prisma/erros';
import { PrismaService } from '../prisma/prisma.service';
import { gerarCodigoDeConvite } from './codigo-de-convite';
import type { AtualizarTurmaDto, CriarTurmaDto } from './turmas.dto';
import { paraMatricula, paraTurma } from './mapeadores';

/** Colisao do codigo de convite e rara (32^4 por ano); poucas tentativas bastam. */
const TENTATIVAS_DE_CODIGO = 5;

@Injectable()
export class TurmasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Inclui as arquivadas: a tela separa ativas e arquivadas por conta propria. */
  async listar(professorId: string): Promise<Turma[]> {
    const turmas = await this.prisma.turma.findMany({
      where: { teacherId: professorId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return turmas.map(paraTurma);
  }

  async criar(professorId: string, dados: CriarTurmaDto): Promise<Turma> {
    for (let tentativa = 1; ; tentativa += 1) {
      try {
        const turma = await this.prisma.turma.create({
          data: { ...dados, teacherId: professorId, inviteCode: gerarCodigoDeConvite() },
        });
        return paraTurma(turma);
      } catch (erro) {
        if (!ehViolacaoDeUnicidade(erro)) throw erro;
        if (dados.id) await this.recusarIdOcupado(professorId, dados.id);
        if (tentativa >= TENTATIVAS_DE_CODIGO) throw erro;
      }
    }
  }

  async atualizar(professorId: string, id: string, dados: AtualizarTurmaDto): Promise<Turma> {
    await this.garantirTurmaDoProfessor(professorId, id);
    return paraTurma(await this.prisma.turma.update({ where: { id }, data: dados }));
  }

  /** Exclusao logica: as aplicacoes associadas continuam existindo. */
  async arquivar(professorId: string, id: string): Promise<Turma> {
    await this.garantirTurmaDoProfessor(professorId, id);
    const turma = await this.prisma.turma.update({ where: { id }, data: { status: 'archived' } });
    return paraTurma(turma);
  }

  /** O codigo anterior deixa de valer no mesmo instante em que o novo e gravado. */
  async regenerarCodigoDeConvite(professorId: string, id: string): Promise<Turma> {
    await this.garantirTurmaDoProfessor(professorId, id);
    for (let tentativa = 1; ; tentativa += 1) {
      try {
        const turma = await this.prisma.turma.update({
          where: { id },
          data: { inviteCode: gerarCodigoDeConvite() },
        });
        return paraTurma(turma);
      } catch (erro) {
        if (!ehViolacaoDeUnicidade(erro) || tentativa >= TENTATIVAS_DE_CODIGO) throw erro;
      }
    }
  }

  /** Todas as matriculas das turmas do professor, ativas e removidas. */
  async listarMatriculas(professorId: string): Promise<Matricula[]> {
    const matriculas = await this.prisma.matricula.findMany({
      where: { turma: { teacherId: professorId } },
      orderBy: [{ enrolledAt: 'asc' }, { id: 'asc' }],
    });
    return matriculas.map(paraMatricula);
  }

  /** Remover nao apaga notas ja lancadas: a matricula so muda de situacao. */
  async alterarSituacaoDaMatricula(
    professorId: string,
    id: string,
    status: Matricula['status'],
  ): Promise<Matricula> {
    const matricula = await this.prisma.matricula.findFirst({
      where: { id, turma: { teacherId: professorId } },
    });
    if (!matricula) throw new NotFoundException('Matricula nao encontrada.');
    return paraMatricula(await this.prisma.matricula.update({ where: { id }, data: { status } }));
  }

  /**
   * Id ja usado: conflito se a turma e do proprio professor; se e de outro, responde
   * como inexistente para nao revelar que ela existe (RNF04).
   */
  private async recusarIdOcupado(professorId: string, id: string): Promise<void> {
    const turma = await this.prisma.turma.findUnique({
      where: { id },
      select: { teacherId: true },
    });
    if (!turma) return;
    if (turma.teacherId !== professorId) throw new NotFoundException('Turma nao encontrada.');
    throw new ConflictException('Ja existe uma turma com este id.');
  }

  private async garantirTurmaDoProfessor(professorId: string, id: string): Promise<void> {
    const turma = await this.prisma.turma.findFirst({
      where: { id, teacherId: professorId },
      select: { id: true },
    });
    if (!turma) throw new NotFoundException('Turma nao encontrada.');
  }
}
