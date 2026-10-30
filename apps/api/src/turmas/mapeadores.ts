import type { Matricula, Turma } from '@sgp/shared-types';
import type {
  Matricula as MatriculaDoBanco,
  Turma as TurmaDoBanco,
} from '../generated/prisma/client';

export function paraTurma(turma: TurmaDoBanco): Turma {
  return {
    id: turma.id,
    teacherId: turma.teacherId,
    name: turma.name,
    subject: turma.subject,
    term: turma.term,
    status: turma.status,
    inviteCode: turma.inviteCode,
    createdAt: turma.createdAt.toISOString(),
  };
}

export function paraMatricula(matricula: MatriculaDoBanco): Matricula {
  return {
    id: matricula.id,
    classId: matricula.classId,
    studentId: matricula.studentId,
    enrolledAt: matricula.enrolledAt.toISOString(),
    status: matricula.status,
    enrolledVia: matricula.enrolledVia,
  };
}
