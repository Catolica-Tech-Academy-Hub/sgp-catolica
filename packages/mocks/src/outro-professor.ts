import type { Matricula, Professor, Questao, Turma } from '@sgp/shared-types';

/**
 * Um segundo professor, com acervo proprio, para demonstrar o isolamento por dono
 * (RNF04, issue #83). Fica fora de `turmasMock`, `questoesMock` e `matriculasMock`
 * porque as telas no modo de demonstracao mostram o acervo de `professorMock`; so o
 * seed da API usa estes dados.
 *
 * A estudante `est-1` tambem esta matriculada aqui: o mesmo estudante pode cursar
 * turmas de professores diferentes, e cada professor so enxerga a propria matricula.
 */
export const outroProfessorMock: Professor = {
  id: 'prof-2',
  role: 'professor',
  fullName: 'Rafael Tavares',
  email: 'rafael.tavares@docente.example.org',
  createdAt: '2026-02-11T12:00:00.000Z',
};

export const turmasDoOutroProfessorMock: Turma[] = [
  {
    id: 'turma-prof-2-1',
    teacherId: outroProfessorMock.id,
    name: 'Calculo I',
    subject: 'Matematica',
    term: '2026/1',
    status: 'active',
    inviteCode: 'CAL-2026-R8TN',
    createdAt: '2026-02-22T12:00:00.000Z',
  },
];

export const matriculasDoOutroProfessorMock: Matricula[] = [
  {
    id: 'mat-prof-2-1',
    classId: 'turma-prof-2-1',
    studentId: 'est-1',
    enrolledAt: '2026-02-23T12:00:00.000Z',
    status: 'active',
    enrolledVia: 'invite_code',
  },
];

export const questoesDoOutroProfessorMock: Questao[] = [
  {
    id: 'q-prof-2-1',
    teacherId: outroProfessorMock.id,
    type: 'objetiva',
    statement: 'Qual e a derivada de x ao quadrado?',
    tags: ['derivadas'],
    alternatives: [
      { id: 'q-prof-2-1-a', text: 'x' },
      { id: 'q-prof-2-1-b', text: '2x' },
      { id: 'q-prof-2-1-c', text: 'x ao cubo dividido por 3' },
    ],
    correctAlternativeId: 'q-prof-2-1-b',
  },
];
