import { Injectable } from '@nestjs/common';
import type { Estudante } from '@sgp/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { PROFESSOR_ATUAL_ID } from '../professor-atual';

@Injectable()
export class EstudantesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Somente estudantes que ja passaram por alguma turma do professor (RNF05): o
   * professor nao enxerga o cadastro inteiro de estudantes do sistema.
   */
  async listar(): Promise<Estudante[]> {
    const estudantes = await this.prisma.usuario.findMany({
      where: {
        role: 'estudante',
        matriculas: { some: { turma: { teacherId: PROFESSOR_ATUAL_ID } } },
      },
      orderBy: { fullName: 'asc' },
    });

    return estudantes.map((estudante) => ({
      id: estudante.id,
      role: 'estudante',
      fullName: estudante.fullName,
      email: estudante.email,
      registration: estudante.registration ?? undefined,
      createdAt: estudante.createdAt.toISOString(),
      anonymizedAt: estudante.anonymizedAt?.toISOString(),
    }));
  }
}
