import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Matricula, Turma } from '@sgp/shared-types';
import { ehViolacaoDeUnicidade } from '../prisma/erros';
import { PrismaService } from '../prisma/prisma.service';
import { PROFESSOR_ATUAL_ID } from '../professor-atual';
import { gerarCodigoDeConvite } from './codigo-de-convite';
import type { AtualizarTurmaDto, CriarTurmaDto } from './turmas.dto';
import { paraMatricula, paraTurma } from './mapeadores';

/** Colisao do codigo de convite e rara (32^4 por ano); poucas tentativas bastam. */
const TENTATIVAS_DE_CODIGO = 5;

@Injectable()
export class TurmasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Inclui as arquivadas: a tela separa ativas e arquivadas por conta propria. */
  async listar(): Promise<Turma[]> {
    const turmas = await this.prisma.turma.findMany({
      where: { teacherId: PROFESSOR_ATUAL_ID },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return turmas.map(paraTurma);
  }

  async criar(dados: CriarTurmaDto): Promise<Turma> {
    for (let tentativa = 1; ; tentativa += 1) {
      try {
        const turma = await this.prisma.turma.create({
          data: { ...dados, teacherId: PROFESSOR_ATUAL_ID, inviteCode: gerarCodigoDeConvite() },
        });
        return paraTurma(turma);
      } catch (erro) {
        if (!ehViolacaoDeUnicidade(erro)) throw erro;
        if (dados.id && (await this.prisma.turma.findUnique({ where: { id: dados.id } }))) {
          throw new ConflictException('Ja existe uma turma com este id.');
        }
        if (tentativa >= TENTATIVAS_DE_CODIGO) throw erro;
      }
    }
  }

  async atualizar(id: string, dados: AtualizarTurmaDto): Promise<Turma> {
    await this.garantirTurmaDoProfessor(id);
    return paraTurma(await this.prisma.turma.update({ where: { id }, data: dados }));
  }

  /** Exclusao logica: as aplicacoes associadas continuam existindo. */
  async arquivar(id: string): Promise<Turma> {
    await this.garantirTurmaDoProfessor(id);
    const turma = await this.prisma.turma.update({ where: { id }, data: { status: 'archived' } });
    return paraTurma(turma);
  }

  /** O codigo anterior deixa de valer no mesmo instante em que o novo e gravado. */
  async regenerarCodigoDeConvite(id: string): Promise<Turma> {
    await this.garantirTurmaDoProfessor(id);
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
  async listarMatriculas(): Promise<Matricula[]> {
    const matriculas = await this.prisma.matricula.findMany({
      where: { turma: { teacherId: PROFESSOR_ATUAL_ID } },
      orderBy: [{ enrolledAt: 'asc' }, { id: 'asc' }],
    });
    return matriculas.map(paraMatricula);
  }

  /** Remover nao apaga notas ja lancadas: a matricula so muda de situacao. */
  async alterarSituacaoDaMatricula(id: string, status: Matricula['status']): Promise<Matricula> {
    const matricula = await this.prisma.matricula.findFirst({
      where: { id, turma: { teacherId: PROFESSOR_ATUAL_ID } },
    });
    if (!matricula) throw new NotFoundException('Matricula nao encontrada.');
    return paraMatricula(await this.prisma.matricula.update({ where: { id }, data: { status } }));
  }

  private async garantirTurmaDoProfessor(id: string): Promise<void> {
    const turma = await this.prisma.turma.findFirst({
      where: { id, teacherId: PROFESSOR_ATUAL_ID },
      select: { id: true },
    });
    if (!turma) throw new NotFoundException('Turma nao encontrada.');
  }
}
