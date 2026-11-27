import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { type ProvaComBlocos, incluirQuestoes, paraProva } from './mapeadores';
import type { SalvarProvaDto } from './provas.dto';

@Injectable()
export class ProvasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(professorId: string): Promise<ProvaComBlocos[]> {
    const provas = await this.prisma.prova.findMany({
      where: { teacherId: professorId },
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
  async salvar(professorId: string, id: string, dados: SalvarProvaDto): Promise<ProvaComBlocos> {
    const existente = await this.prisma.prova.findUnique({
      where: { id },
      select: { teacherId: true },
    });
    // A prova de outro professor nao e revelada nem sobrescrita.
    if (existente && existente.teacherId !== professorId) {
      throw new NotFoundException('Prova nao encontrada.');
    }

    const questoes = await this.questoesGravaveis(professorId, dados.questions);
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
          teacherId: professorId,
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

  async encerrar(professorId: string, id: string): Promise<ProvaComBlocos> {
    const resultado = await this.prisma.prova.updateMany({
      where: { id, teacherId: professorId },
      data: { status: 'closed' },
    });
    if (resultado.count === 0) {
      const existente = await this.prisma.prova.findFirst({
        where: { id, teacherId: professorId },
        include: incluirQuestoes,
      });
      if (!existente) throw new NotFoundException('Prova nao encontrada.');
      return paraProva(existente);
    }

    const prova = await this.prisma.prova.findFirst({
      where: { id, teacherId: professorId },
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
  private async questoesGravaveis(professorId: string, questoes: SalvarProvaDto['questions']) {
    const ids = [...new Set(questoes.map((questao) => questao.questionId))];
    const doBanco = await this.prisma.questao.findMany({
      where: { id: { in: ids }, teacherId: professorId },
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
