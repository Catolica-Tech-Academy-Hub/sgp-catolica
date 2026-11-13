import type { Estudante } from '@sgp/shared-types';
import type { Usuario as UsuarioDoBanco } from '../generated/prisma/client';

export function paraEstudante(estudante: UsuarioDoBanco): Estudante {
  return {
    id: estudante.id,
    role: 'estudante',
    fullName: estudante.fullName,
    email: estudante.email,
    registration: estudante.registration ?? undefined,
    createdAt: estudante.createdAt.toISOString(),
    anonymizedAt: estudante.anonymizedAt?.toISOString(),
  };
}
