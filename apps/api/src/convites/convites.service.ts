import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Estudante, Matricula, StatusTurma } from '@sgp/shared-types';
import type { UsuarioAutenticado } from '../autenticacao/usuario-autenticado';
import type { Prisma } from '../generated/prisma/client';
import { ehViolacaoDeUnicidade } from '../prisma/erros';
import { PrismaService } from '../prisma/prisma.service';
import { paraMatricula } from '../turmas/mapeadores';
import type { CadastroPeloConviteDto } from './convites.dto';
import {
  CREDENCIAIS_DO_ESTUDANTE,
  type CredenciaisDoEstudante,
  type SessaoDoEstudante,
} from './credenciais';
import {
  type MotivoDeRecusa,
  decidirEntrada,
  emailDeEstudante,
  mensagemDaRecusa,
  normalizarCodigo,
  normalizarEmail,
} from './regras';

/** O que a tela de entrada mostra antes de o estudante confirmar. */
export interface TurmaDoConvite {
  name: string;
  subject: string;
  term: string;
  teacherName: string;
  status: StatusTurma;
}

export interface ResultadoDaEntrada {
  matricula: Matricula;
  /** Presente no cadastro novo: a conta criada e a sessao aberta (RF03). */
  estudante?: Estudante;
  sessao?: SessaoDoEstudante;
}

function recusa(motivo: MotivoDeRecusa): Error {
  const mensagem = mensagemDaRecusa[motivo];
  return motivo === 'codigo-invalido'
    ? new NotFoundException(mensagem)
    : new ConflictException(mensagem);
}

/** Entrada do estudante numa turma pelo codigo de convite (RF03). */
@Injectable()
export class ConvitesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CREDENCIAIS_DO_ESTUDANTE) private readonly credenciais: CredenciaisDoEstudante,
  ) {}

  /** Codigo regenerado nao encontra mais a turma: responde como invalido. */
  async consultar(codigo: string): Promise<TurmaDoConvite> {
    const turma = await this.prisma.turma.findUnique({
      where: { inviteCode: normalizarCodigo(codigo) },
      include: { professor: { select: { fullName: true } } },
    });
    if (!turma) throw recusa('codigo-invalido');
    return {
      name: turma.name,
      subject: turma.subject,
      term: turma.term,
      teacherName: turma.professor.fullName,
      status: turma.status,
    };
  }

  /**
   * Com sessao de estudante, matricula quem esta logado. Sem sessao, cadastra a conta e
   * matricula na mesma transacao. Professor nao entra em turma por convite.
   */
  async entrar(
    codigo: string,
    usuario: UsuarioAutenticado | undefined,
    cadastro: () => Promise<CadastroPeloConviteDto>,
  ): Promise<ResultadoDaEntrada> {
    if (usuario?.role === 'professor') {
      throw new ForbiddenException('O codigo de convite e para estudantes.');
    }
    if (usuario) return { matricula: await this.matricularEstudante(codigo, usuario.id) };
    return this.cadastrarEMatricular(codigo, await cadastro());
  }

  /** O mesmo codigo usado de novo devolve a matricula existente, sem duplicar. */
  async matricularEstudante(codigo: string, studentId: string): Promise<Matricula> {
    return this.prisma.$transaction((tx) => this.matricular(tx, codigo, studentId));
  }

  /**
   * RF03: conta nova e matricula na mesma transacao, e o estudante sai autenticado. Se a
   * matricula for recusada (codigo invalido, turma arquivada), a conta tambem nao fica.
   */
  async cadastrarEMatricular(
    codigo: string,
    dados: CadastroPeloConviteDto,
  ): Promise<ResultadoDaEntrada> {
    const email = normalizarEmail(dados.email);
    if (!emailDeEstudante(email)) {
      throw new BadRequestException(
        'Use o e-mail institucional de estudante (@catolicasc.edu.br).',
      );
    }
    // Antes da transacao: sem login (#81) responde 501 sem gravar nada.
    const passwordHash = await this.credenciais.prepararSenha(dados.password);

    let criado: { estudante: Estudante; matricula: Matricula };
    try {
      criado = await this.prisma.$transaction(async (tx) => {
        const usuario = await tx.usuario.create({
          data: {
            role: 'estudante',
            fullName: dados.fullName.trim(),
            email,
            registration: dados.registration?.trim() || null,
            passwordHash,
          },
        });
        const matricula = await this.matricular(tx, codigo, usuario.id);
        return {
          matricula,
          estudante: {
            id: usuario.id,
            role: 'estudante' as const,
            fullName: usuario.fullName,
            email: usuario.email,
            registration: usuario.registration ?? undefined,
            createdAt: usuario.createdAt.toISOString(),
          },
        };
      });
    } catch (erro) {
      if (ehViolacaoDeUnicidade(erro)) {
        throw new ConflictException(
          'Ja existe conta com este e-mail ou matricula. Entre com ela e use o codigo de novo.',
        );
      }
      throw erro;
    }

    const sessao = await this.credenciais.abrirSessao({ id: criado.estudante.id });
    return { ...criado, sessao };
  }

  private async matricular(
    tx: Prisma.TransactionClient,
    codigo: string,
    studentId: string,
  ): Promise<Matricula> {
    const turma = await tx.turma.findUnique({
      where: { inviteCode: normalizarCodigo(codigo) },
      select: { id: true, status: true },
    });
    const existente = turma
      ? await tx.matricula.findUnique({
          where: { classId_studentId: { classId: turma.id, studentId } },
        })
      : null;

    const decisao = decidirEntrada({
      turma: turma ?? undefined,
      matriculaExistente: existente ?? undefined,
    });
    if (decisao.tipo === 'recusar') throw recusa(decisao.motivo);
    if (decisao.tipo === 'ja-matriculado') return paraMatricula(existente!);

    try {
      const matricula = await tx.matricula.create({
        data: { classId: turma!.id, studentId, enrolledVia: 'invite_code' },
      });
      return paraMatricula(matricula);
    } catch (erro) {
      // Duas entradas simultaneas com o mesmo codigo: a outra ja gravou a matricula.
      if (!ehViolacaoDeUnicidade(erro)) throw erro;
      const gravada = await tx.matricula.findUnique({
        where: { classId_studentId: { classId: turma!.id, studentId } },
      });
      if (!gravada) throw erro;
      return paraMatricula(gravada);
    }
  }
}
