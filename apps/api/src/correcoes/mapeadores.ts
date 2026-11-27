import type { Correcao, NotaDiscursiva, ResultadoObjetivo } from '@sgp/shared-types';
import type { Correcao as CorrecaoDoBanco } from '../generated/prisma/client';

/** Formato de `@sgp/shared-types`; snapshot e motivo de revisao ficam so no banco. */
export function paraCorrecao(correcao: CorrecaoDoBanco): Correcao {
  const base: Correcao = {
    id: correcao.id,
    examVersionId: correcao.examVersionId,
    objectiveResults: correcao.objectiveResults as unknown as ResultadoObjetivo[],
    discursiveScores: correcao.discursiveScores as unknown as NotaDiscursiva[],
    totalScore: Number(correcao.totalScore),
    confirmedAt: correcao.confirmedAt.toISOString(),
    correctedBy: correcao.correctedBy,
    isAutomaticallyAssigned: correcao.isAutomaticallyAssigned,
    clientCorrectionId: correcao.clientCorrectionId,
    syncStatus: correcao.syncStatus,
  };

  if (correcao.studentId !== null) base.studentId = correcao.studentId;
  if (correcao.reportedStudentName !== null)
    base.reportedStudentName = correcao.reportedStudentName;
  if (correcao.reportedStudentRegistration !== null) {
    base.reportedStudentRegistration = correcao.reportedStudentRegistration;
  }
  if (correcao.notes !== null) base.notes = correcao.notes;

  return base;
}
