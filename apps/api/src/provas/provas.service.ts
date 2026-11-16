import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Aplicacao } from '@sgp/shared-types';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PROFESSOR_ATUAL_ID } from '../professor-atual';
import { type ProvaComBlocos, incluirQuestoes, paraProva } from './mapeadores';
import type { SalvarProvaDto } from './provas.dto';

@Injectable()
export class ProvasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<ProvaComBlocos[]> {
    const provas = await this.prisma.prova.findMany({
      where: { teacherId: PROFESSOR_ATUAL_ID },
      include: incluirQuestoes,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return provas.map(paraProva);
  }

  /**
   * Cria ou atualiza pelo id, que nasce no navegador para o editor abrir sem esperar a
   * resposta. As questoes da prova sao regravadas inteiras: a ordem da folha e a
   * pontuacao mudam juntas no editor.
   */
  async salvar(id: string, dados: SalvarProvaDto): Promise<ProvaComBlocos> {
    const existente = await this.prisma.prova.findUnique({
      where: { id },
      select: { teacherId: true },
    });
    // A prova de outro professor nao e revelada nem sobrescrita.
    if (existente && existente.teacherId !== PROFESSOR_ATUAL_ID) {
      throw new NotFoundException('Prova nao encontrada.');
    }

    const questoes = await this.questoesGravaveis(dados.questions);
    const campos = {
      title: dados.title,
      description: dados.description ?? null,
      blocos: dados.blocos ? (dados.blocos as Prisma.InputJsonValue[]) : Prisma.DbNull,
    };

    const prova = await this.prisma.$transaction(async (tx) => {
      await tx.questaoDaProva.deleteMany({ where: { examId: id } });
      return tx.prova.upsert({
        where: { id },
        create: {
          id,
          teacherId: PROFESSOR_ATUAL_ID,
          ...campos,
          status: 'draft',
          questoes: { create: questoes },
        },
        update: { ...campos, questoes: { create: questoes } },
        include: incluirQuestoes,
      });
    });

    return paraProva(prova);
  }

  async criarAplicacao(examId: string, classId: string): Promise<Aplicacao> {
    return this.prisma.$transaction(async (tx) => {
      const prova = await tx.prova.findFirst({
        where: { id: examId, teacherId: PROFESSOR_ATUAL_ID },
        select: { id: true, status: true },
      });
      if (!prova) throw new NotFoundException('Prova nao encontrada.');
      if (prova.status === 'closed') {
        throw new ConflictException('Prova encerrada nao aceita novas aplicacoes.');
      }

      const turma = await tx.turma.findFirst({
        where: { id: classId, teacherId: PROFESSOR_ATUAL_ID },
        select: { id: true },
      });
      if (!turma) throw new NotFoundException('Turma nao encontrada.');

      // Atualizacao condicional e inclusa na transacao para que encerrar e aplicar
      // concorrentes sejam serializados pela linha da prova.
      const atualizada = await tx.prova.updateMany({
        where: { id: examId, teacherId: PROFESSOR_ATUAL_ID, status: { not: 'closed' } },
        data: { status: 'ready' },
      });
      if (atualizada.count !== 1) {
        throw new ConflictException('Prova encerrada nao aceita novas aplicacoes.');
      }

      const aplicacao = await tx.aplicacao.create({
        data: { examId, classId, teacherId: PROFESSOR_ATUAL_ID },
      });
      return {
        id: aplicacao.id,
        examId: aplicacao.examId,
        classId: aplicacao.classId,
        teacherId: aplicacao.teacherId,
        status: aplicacao.status,
        createdAt: aplicacao.createdAt.toISOString(),
        ...(aplicacao.pdfUrl !== null ? { pdfUrl: aplicacao.pdfUrl } : {}),
      };
    });
  }

  async encerrar(id: string): Promise<ProvaComBlocos> {
    const resultado = await this.prisma.prova.updateMany({
      where: { id, teacherId: PROFESSOR_ATUAL_ID },
      data: { status: 'closed' },
    });
    if (resultado.count === 0) {
      const existente = await this.prisma.prova.findFirst({
        where: { id, teacherId: PROFESSOR_ATUAL_ID },
        include: incluirQuestoes,
      });
      if (!existente) throw new NotFoundException('Prova nao encontrada.');
      return paraProva(existente);
    }

    const prova = await this.prisma.prova.findFirst({
      where: { id, teacherId: PROFESSOR_ATUAL_ID },
      include: incluirQuestoes,
    });
    if (!prova) throw new NotFoundException('Prova nao encontrada.');
    return paraProva(prova);
  }

  /**
   * So entram em `questoes_da_prova` as questoes que ja existem no banco do professor
   * (inclusive as excluidas, que uma prova antiga continua usando). A questao criada
   * dentro da prova e ainda nao salva no banco vive apenas nos blocos do editor.
   * Uma questao repetida conta uma vez, na primeira posicao em que aparece.
   */
  private async questoesGravaveis(questoes: SalvarProvaDto['questions']) {
    const ids = [...new Set(questoes.map((questao) => questao.questionId))];
    const doBanco = await this.prisma.questao.findMany({
      where: { id: { in: ids }, teacherId: PROFESSOR_ATUAL_ID },
      select: { id: true },
    });
    const existentes = new Set(doBanco.map((questao) => questao.id));
    const vistas = new Set<string>();

    return [...questoes]
      .sort((a, b) => a.order - b.order)
      .filter((questao) => {
        if (!existentes.has(questao.questionId) || vistas.has(questao.questionId)) return false;
        vistas.add(questao.questionId);
        return true;
      })
      .map((questao, indice) => ({
        questionId: questao.questionId,
        order: indice + 1,
        score: questao.score,
      }));
  }
}
