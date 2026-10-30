import { Injectable, NotFoundException } from '@nestjs/common';
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
      status: dados.status,
      blocos: dados.blocos ? (dados.blocos as Prisma.InputJsonValue[]) : Prisma.DbNull,
    };

    const prova = await this.prisma.$transaction(async (tx) => {
      await tx.questaoDaProva.deleteMany({ where: { examId: id } });
      return tx.prova.upsert({
        where: { id },
        create: { id, teacherId: PROFESSOR_ATUAL_ID, ...campos, questoes: { create: questoes } },
        update: { ...campos, questoes: { create: questoes } },
        include: incluirQuestoes,
      });
    });

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
