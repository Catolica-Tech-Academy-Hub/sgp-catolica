import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Questao } from '@sgp/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { PROFESSOR_ATUAL_ID } from '../professor-atual';
import { incluirAlternativas, paraQuestao } from './mapeadores';
import type { SalvarQuestaoDto } from './questoes.dto';
import { validarQuestao } from './regras';

@Injectable()
export class QuestoesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Por padrao, so o acervo ativo. `incluirExcluidas` existe porque uma prova que ja
   * referencia uma questao excluida precisa continuar renderizando o enunciado.
   */
  async listar(incluirExcluidas: boolean): Promise<Questao[]> {
    const questoes = await this.prisma.questao.findMany({
      where: { teacherId: PROFESSOR_ATUAL_ID, ...(incluirExcluidas ? {} : { deletedAt: null }) },
      include: incluirAlternativas,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return questoes.map(paraQuestao);
  }

  /** Encontra inclusive a excluida, pelo mesmo motivo de `listar`. */
  async obter(id: string): Promise<Questao> {
    const questao = await this.prisma.questao.findFirst({
      where: { id, teacherId: PROFESSOR_ATUAL_ID },
      include: incluirAlternativas,
    });
    if (!questao) throw new NotFoundException('Questao nao encontrada.');
    return paraQuestao(questao);
  }

  /**
   * Cria ou atualiza pelo id, que vem do editor no navegador. Salvar uma questao a
   * devolve ao acervo ativo, como faz "Salvar no banco" no editor de prova.
   */
  async salvar(id: string, dados: SalvarQuestaoDto): Promise<Questao> {
    const problemas = validarQuestao(dados);
    if (problemas.length) throw new BadRequestException(problemas);

    const existente = await this.prisma.questao.findUnique({
      where: { id },
      select: { teacherId: true },
    });
    // A questao de outro professor nao e revelada nem sobrescrita.
    if (existente && existente.teacherId !== PROFESSOR_ATUAL_ID) {
      throw new NotFoundException('Questao nao encontrada.');
    }

    const objetiva = dados.type === 'objetiva';
    const campos = {
      type: dados.type,
      statement: dados.statement,
      tags: dados.tags,
      correctAlternativeId: objetiva ? dados.correctAlternativeId : null,
      maxScore: objetiva ? null : dados.maxScore,
      deletedAt: null,
    };
    const alternativas = (objetiva ? (dados.alternatives ?? []) : []).map(
      (alternativa, position) => ({ id: alternativa.id, text: alternativa.text, position }),
    );

    const questao = await this.prisma.$transaction(async (tx) => {
      if (existente) {
        await tx.alternativa.deleteMany({ where: { questionId: id } });
        return tx.questao.update({
          where: { id },
          data: { ...campos, alternativas: { create: alternativas } },
          include: incluirAlternativas,
        });
      }
      return tx.questao.create({
        data: {
          id,
          teacherId: PROFESSOR_ATUAL_ID,
          ...campos,
          alternativas: { create: alternativas },
        },
        include: incluirAlternativas,
      });
    });

    return paraQuestao(questao);
  }

  /** Exclusao logica; `restaurar` desfaz. */
  async alterarExclusao(id: string, excluida: boolean): Promise<Questao> {
    await this.obter(id);
    const questao = await this.prisma.questao.update({
      where: { id },
      data: { deletedAt: excluida ? new Date() : null },
      include: incluirAlternativas,
    });
    return paraQuestao(questao);
  }
}
