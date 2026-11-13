import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Estudante, Matricula, Turma } from '@sgp/shared-types';
import { paraEstudante } from '../estudantes/mapeadores';
import { ehViolacaoDeUnicidade } from '../prisma/erros';
import { PrismaService } from '../prisma/prisma.service';
import { PROFESSOR_ATUAL_ID } from '../professor-atual';
import { gerarCodigoDeConvite } from './codigo-de-convite';
import type { AtualizarTurmaDto, CriarTurmaDto } from './turmas.dto';
import { paraMatricula, paraTurma } from './mapeadores';
import { decidirMatricula, mensagemDaRecusa, normalizarEmail } from './regras-de-matricula';

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

  /**
   * RF03: matricula por e-mail um estudante que ja tem conta. Devolve tambem o
   * estudante, que pode ainda nao estar entre os que a tela conhece (`GET /estudantes`
   * so traz quem ja passou pelas turmas do professor).
   */
  async matricularPorEmail(
    classId: string,
    email: string,
  ): Promise<{ matricula: Matricula; estudante: Estudante }> {
    const turma = await this.prisma.turma.findFirst({
      where: { id: classId, teacherId: PROFESSOR_ATUAL_ID },
      select: { status: true },
    });
    if (!turma) throw new NotFoundException('Turma nao encontrada.');

    // A colacao do MySQL ja compara sem diferenciar maiusculas; normalizar tira os espacos.
    const estudante = await this.prisma.usuario.findFirst({
      where: { email: normalizarEmail(email), role: 'estudante' },
    });
    const matriculaExistente = estudante
      ? await this.prisma.matricula.findUnique({
          where: { classId_studentId: { classId, studentId: estudante.id } },
        })
      : null;

    const decisao = decidirMatricula({
      statusDaTurma: turma.status,
      estudante: estudante ? { anonimizado: estudante.anonymizedAt !== null } : undefined,
      matriculaExistente: matriculaExistente ?? undefined,
    });

    if (decisao.tipo === 'recusar') {
      const mensagem = mensagemDaRecusa[decisao.motivo];
      throw decisao.motivo === 'estudante-inexistente'
        ? new NotFoundException(mensagem)
        : new ConflictException(mensagem);
    }

    // `decidirMatricula` so libera com estudante encontrado.
    const studentId = estudante!.id;
    try {
      const matricula =
        decisao.tipo === 'reativar'
          ? await this.prisma.matricula.update({
              where: { classId_studentId: { classId, studentId } },
              data: { status: 'active', enrolledVia: 'teacher' },
            })
          : await this.prisma.matricula.create({
              data: { classId, studentId, enrolledVia: 'teacher' },
            });
      return { matricula: paraMatricula(matricula), estudante: paraEstudante(estudante!) };
    } catch (erro) {
      // Duas matriculas simultaneas do mesmo aluno: a unicidade do banco decide.
      if (ehViolacaoDeUnicidade(erro)) {
        throw new ConflictException(mensagemDaRecusa['ja-matriculado']);
      }
      throw erro;
    }
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
