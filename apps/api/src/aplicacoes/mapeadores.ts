import type { Aplicacao } from '@sgp/shared-types';
import type { Aplicacao as AplicacaoDoBanco } from '../generated/prisma/client';

export function paraAplicacao(aplicacao: AplicacaoDoBanco): Aplicacao {
  return {
    id: aplicacao.id,
    examId: aplicacao.examId,
    classId: aplicacao.classId,
    teacherId: aplicacao.teacherId,
    status: aplicacao.status,
    createdAt: aplicacao.createdAt.toISOString(),
    ...(aplicacao.pdfUrl !== null ? { pdfUrl: aplicacao.pdfUrl } : {}),
  };
}
