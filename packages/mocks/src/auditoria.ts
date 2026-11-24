import type { Estudante, Questao } from '@sgp/shared-types';
import {
  aplicacoesMock,
  atribuicoesMock,
  correcoesMock,
  estudanteLogadoMock,
  estudantesMock,
  filaCorrecoesMock,
  matriculasMock,
  notasDoEstudanteMock,
  matriculasDoOutroProfessorMock,
  outroProfessorMock,
  professorMock,
  provasMock,
  questoesDoOutroProfessorMock,
  questoesMock,
  turmasDoOutroProfessorMock,
  turmasMock,
  versoesMock,
} from './index';

/**
 * Auditoria de coerencia dos dados estaticos da fase N1.
 *
 * Os mocks substituem o banco de dados enquanto nao existe backend, e por isso
 * nao ha nada que impeca uma correcao de apontar para uma versao inexistente ou
 * uma nota de nao fechar com a soma das questoes. Esta auditoria ocupa esse
 * lugar: confere as mesmas regras que o banco e a API vao cobrar na N2.
 *
 * Roda com `npm run audit:mocks`. Nao depende de runner de teste nem de
 * biblioteca externa.
 */
export interface ResultadoAuditoria {
  verificacoes: number;
  falhas: string[];
}

const TOLERANCIA = 1e-9;

const porId = <T extends { id: string }>(itens: T[]): Map<string, T> =>
  new Map(itens.map((item) => [item.id, item]));

/** Ordem em que as alternativas foram cadastradas, usada quando nao ha embaralhamento. */
const ordemDeCadastro = (questao: Questao): string[] =>
  (questao.alternatives ?? []).map((alternativa) => alternativa.id);

export function auditarMocks(): ResultadoAuditoria {
  const falhas: string[] = [];
  let verificacoes = 0;

  const conferir = (condicao: boolean, descricao: string): boolean => {
    verificacoes += 1;
    if (!condicao) falhas.push(descricao);
    return condicao;
  };

  const provas = porId(provasMock);
  const aplicacoes = porId(aplicacoesMock);
  const versoes = porId(versoesMock);
  const questoes = porId(questoesMock);
  const turmas = porId(turmasMock);
  const estudantes: Map<string, Estudante> = porId(estudantesMock);

  // --- Banco de questoes (RF02) ---
  for (const questao of questoesMock) {
    conferir(questao.teacherId === professorMock.id, `${questao.id}: pertence ao professor`);
    if (questao.type === 'objetiva') {
      const alternativas = questao.alternatives ?? [];
      conferir(
        alternativas.length >= 2 && alternativas.length <= 5,
        `${questao.id}: questao objetiva tem de 2 a 5 alternativas`,
      );
      conferir(
        alternativas.filter((a) => a.id === questao.correctAlternativeId).length === 1,
        `${questao.id}: questao objetiva tem exatamente uma alternativa correta`,
      );
    } else {
      conferir(
        typeof questao.maxScore === 'number',
        `${questao.id}: questao discursiva tem pontuacao maxima`,
      );
    }
  }

  // --- Turmas e matriculas (RF01, RF03) ---
  const codigos = new Set<string>();
  for (const turma of turmasMock) {
    conferir(turma.teacherId === professorMock.id, `${turma.id}: pertence ao professor`);
    conferir(!codigos.has(turma.inviteCode), `${turma.id}: codigo de convite unico`);
    codigos.add(turma.inviteCode);
  }
  // Segundo professor (isolamento por dono, RNF04): o codigo de convite e unico no sistema.
  for (const turma of turmasDoOutroProfessorMock) {
    conferir(turma.teacherId === outroProfessorMock.id, `${turma.id}: pertence ao outro professor`);
    conferir(!codigos.has(turma.inviteCode), `${turma.id}: codigo de convite unico`);
    codigos.add(turma.inviteCode);
  }
  for (const questao of questoesDoOutroProfessorMock) {
    conferir(
      questao.teacherId === outroProfessorMock.id,
      `${questao.id}: pertence ao outro professor`,
    );
  }
  for (const matricula of matriculasDoOutroProfessorMock) {
    conferir(estudantes.has(matricula.studentId), `${matricula.id}: estudante existe`);
    conferir(
      turmasDoOutroProfessorMock.some((turma) => turma.id === matricula.classId),
      `${matricula.id}: turma do outro professor existe`,
    );
  }
  const emails = new Set<string>();
  for (const usuario of [professorMock, outroProfessorMock, ...estudantesMock]) {
    conferir(!emails.has(usuario.email), `${usuario.id}: e-mail unico no sistema`);
    emails.add(usuario.email);
  }
  for (const matricula of matriculasMock) {
    conferir(estudantes.has(matricula.studentId), `${matricula.id}: estudante existe`);
    conferir(turmas.has(matricula.classId), `${matricula.id}: turma existe`);
  }

  // --- Provas e aplicacoes (RF04, RF05) ---
  for (const prova of provasMock) {
    conferir(prova.questions.length <= 20, `${prova.id}: no maximo 20 questoes`);
    for (const item of prova.questions) {
      conferir(questoes.has(item.questionId), `${prova.id}: questao ${item.questionId} existe`);
    }
  }
  for (const aplicacao of aplicacoesMock) {
    conferir(provas.has(aplicacao.examId), `${aplicacao.id}: prova ${aplicacao.examId} existe`);
    conferir(turmas.has(aplicacao.classId), `${aplicacao.id}: turma ${aplicacao.classId} existe`);
    conferir(aplicacao.teacherId === professorMock.id, `${aplicacao.id}: pertence ao professor`);
  }

  // --- Versoes: o layout materializa o embaralhamento (RF06) ---
  for (const versao of versoesMock) {
    const aplicacao = aplicacoes.get(versao.applicationId);
    if (!conferir(!!aplicacao, `${versao.id}: aplicacao ${versao.applicationId} existe`)) continue;
    const prova = provas.get(aplicacao!.examId);
    if (!conferir(!!prova, `${versao.id}: prova da aplicacao existe`)) continue;

    const daProva = prova!.questions
      .map((q) => q.questionId)
      .sort()
      .join(',');
    const doLayout = [...versao.layout.questionOrder].sort().join(',');
    conferir(daProva === doLayout, `${versao.id}: layout cobre exatamente as questoes da prova`);

    for (const ordem of versao.layout.alternativeOrder) {
      const questao = questoes.get(ordem.questionId);
      if (!conferir(!!questao, `${versao.id}/${ordem.questionId}: questao existe`)) continue;
      const cadastradas = ordemDeCadastro(questao!).sort().join(',');
      const impressas = [...ordem.printedOrder].sort().join(',');
      conferir(
        cadastradas === impressas,
        `${versao.id}/${ordem.questionId}: ordem impressa usa as mesmas alternativas cadastradas`,
      );
    }
  }

  // --- Atribuicoes: so existem em versao COM identificacao (RF06) ---
  for (const atribuicao of atribuicoesMock) {
    const versao = versoes.get(atribuicao.examVersionId);
    if (!conferir(!!versao, `${atribuicao.id}: versao ${atribuicao.examVersionId} existe`))
      continue;
    conferir(
      versao!.withStudentIdentification,
      `${atribuicao.id}: nao existe atribuicao em versao sem identificacao`,
    );
    conferir(estudantes.has(atribuicao.studentId), `${atribuicao.id}: estudante existe`);
    const aplicacao = aplicacoes.get(versao!.applicationId);
    conferir(
      matriculasMock.some(
        (m) =>
          m.studentId === atribuicao.studentId &&
          m.classId === aplicacao?.classId &&
          m.status === 'active',
      ),
      `${atribuicao.id}: estudante matriculado na turma da aplicacao`,
    );
  }
  for (const versao of versoesMock.filter((v) => !v.withStudentIdentification)) {
    conferir(
      !atribuicoesMock.some((a) => a.examVersionId === versao.id),
      `${versao.id}: versao anonima nao tem nenhuma atribuicao`,
    );
  }

  // --- Correcoes: soma, teto por questao e identificacao (RF06, RF08, RF09) ---
  const parAlunoVersao = new Set<string>();
  for (const correcao of correcoesMock) {
    const versao = versoes.get(correcao.examVersionId);
    if (!conferir(!!versao, `${correcao.id}: versao ${correcao.examVersionId} existe`)) continue;

    const itens = [...correcao.objectiveResults, ...correcao.discursiveScores];
    const soma = itens.reduce((total, item) => total + item.score, 0);
    conferir(
      Math.abs(soma - correcao.totalScore) < TOLERANCIA,
      `${correcao.id}: totalScore ${correcao.totalScore} bate com a soma das questoes (${soma})`,
    );

    conferir(
      correcao.isAutomaticallyAssigned === versao!.withStudentIdentification,
      `${correcao.id}: isAutomaticallyAssigned coerente com withStudentIdentification`,
    );

    if (versao!.withStudentIdentification) {
      conferir(!!correcao.studentId, `${correcao.id}: versao com identificacao tem studentId`);
      conferir(
        atribuicoesMock.some(
          (a) => a.examVersionId === versao!.id && a.studentId === correcao.studentId,
        ),
        `${correcao.id}: existe atribuicao daquele aluno naquela versao`,
      );
    } else {
      conferir(
        !correcao.studentId,
        `${correcao.id}: versao anonima nao atribui aluno automaticamente`,
      );
      conferir(
        correcao.isAutomaticallyAssigned === false,
        `${correcao.id}: versao anonima nunca gera atribuicao automatica`,
      );
    }

    const aplicacao = aplicacoes.get(versao!.applicationId);
    const prova = aplicacao ? provas.get(aplicacao.examId) : undefined;
    if (prova) {
      const valorNaProva = new Map(prova.questions.map((q) => [q.questionId, q.score]));
      for (const item of itens) {
        if (
          !conferir(
            valorNaProva.has(item.questionId),
            `${correcao.id}/${item.questionId}: questao pertence a prova aplicada`,
          )
        )
          continue;
        conferir(
          item.score <= (valorNaProva.get(item.questionId) ?? 0) + TOLERANCIA,
          `${correcao.id}/${item.questionId}: nota nao passa do valor da questao na prova`,
        );
        conferir(item.score >= 0, `${correcao.id}/${item.questionId}: nota nao e negativa`);
      }
    }

    // RF09: nao e possivel atribuir duas correcoes da mesma versao ao mesmo aluno.
    if (correcao.studentId) {
      const chave = `${correcao.examVersionId}|${correcao.studentId}`;
      conferir(!parAlunoVersao.has(chave), `sem correcao duplicada para aluno e versao (${chave})`);
      parAlunoVersao.add(chave);
    }
  }

  // --- Fila offline: snapshot fiel ao layout da versao (RF08) ---
  for (const item of filaCorrecoesMock) {
    const versao = versoes.get(item.examVersionId);
    if (!conferir(!!versao, `fila ${item.clientCorrectionId}: versao existe`)) continue;
    conferir(
      item.answerKeySnapshot.examVersionId === item.examVersionId,
      `fila ${item.clientCorrectionId}: snapshot e da mesma versao do item`,
    );
    if (versao!.withStudentIdentification) {
      conferir(
        !!item.studentId,
        `fila ${item.clientCorrectionId}: versao com identificacao tem studentId`,
      );
    } else {
      conferir(
        !item.studentId,
        `fila ${item.clientCorrectionId}: versao anonima nao carrega studentId`,
      );
    }

    for (const gabarito of item.answerKeySnapshot.objectiveQuestions) {
      const questao = questoes.get(gabarito.questionId);
      if (
        !conferir(
          !!questao,
          `fila ${item.clientCorrectionId}/${gabarito.questionId}: questao existe`,
        )
      )
        continue;
      conferir(
        questao!.correctAlternativeId === gabarito.correctAlternativeId,
        `fila ${item.clientCorrectionId}/${gabarito.questionId}: alternativa correta bate com o banco`,
      );
      const noLayout = versao!.layout.alternativeOrder.find(
        (a) => a.questionId === gabarito.questionId,
      );
      const esperada = noLayout ? noLayout.printedOrder : ordemDeCadastro(questao!);
      conferir(
        JSON.stringify(esperada) === JSON.stringify(gabarito.printedOrder),
        `fila ${item.clientCorrectionId}/${gabarito.questionId}: ordem impressa bate com o layout da versao`,
      );
    }
    for (const gabarito of item.answerKeySnapshot.discursiveQuestions) {
      const questao = questoes.get(gabarito.questionId);
      if (
        !conferir(
          !!questao,
          `fila ${item.clientCorrectionId}/${gabarito.questionId}: questao existe`,
        )
      )
        continue;
      conferir(
        questao!.maxScore === gabarito.maxScore,
        `fila ${item.clientCorrectionId}/${gabarito.questionId}: pontuacao maxima discursiva bate`,
      );
    }

    const correcao = correcoesMock.find((c) => c.clientCorrectionId === item.clientCorrectionId);
    if (item.syncStatus === 'error') {
      // Erro de validacao mantem o item na fila e nao registra Correcao (RF08).
      conferir(!correcao, `fila ${item.clientCorrectionId}: item com erro nao virou Correcao`);
      conferir(
        !!item.syncError,
        `fila ${item.clientCorrectionId}: item com erro descreve o motivo`,
      );
    } else {
      if (!conferir(!!correcao, `fila ${item.clientCorrectionId}: tem Correcao correspondente`))
        continue;
      conferir(
        correcao!.syncStatus === item.syncStatus,
        `fila ${item.clientCorrectionId}: syncStatus igual ao da Correcao`,
      );
    }
  }
  const identificadoresDeFila = filaCorrecoesMock.map((i) => i.clientCorrectionId);
  conferir(
    new Set(identificadoresDeFila).size === identificadoresDeFila.length,
    'fila: clientCorrectionId nao se repete (deduplicacao idempotente)',
  );
  const estados = new Set(filaCorrecoesMock.map((i) => i.syncStatus));
  for (const estado of ['pending', 'synced', 'error'] as const) {
    conferir(estados.has(estado), `fila: existe ao menos um item com status ${estado}`);
  }

  // --- Historico do estudante: projecao derivada das entidades (RF07, RF11) ---
  for (const nota of notasDoEstudanteMock) {
    const aplicacao = aplicacoes.get(nota.applicationId);
    if (!conferir(!!aplicacao, `nota ${nota.applicationId}: aplicacao existe`)) continue;
    const prova = provas.get(aplicacao!.examId);
    const turma = turmas.get(aplicacao!.classId);
    if (!conferir(!!prova && !!turma, `nota ${nota.applicationId}: prova e turma existem`))
      continue;

    const versoesDaAplicacao = versoesMock
      .filter((v) => v.applicationId === aplicacao!.id)
      .map((v) => v.id);
    const correcao = correcoesMock.find(
      (c) => versoesDaAplicacao.includes(c.examVersionId) && c.studentId === estudanteLogadoMock.id,
    );
    if (!conferir(!!correcao, `nota ${nota.applicationId}: existe correcao do estudante logado`))
      continue;

    conferir(
      correcao!.totalScore === nota.totalScore,
      `nota ${nota.applicationId}: totalScore bate com a correcao`,
    );
    const maximo = prova!.questions.reduce((total, q) => total + q.score, 0);
    conferir(
      maximo === nota.maxScore,
      `nota ${nota.applicationId}: maxScore bate com a soma da prova`,
    );
    conferir(
      nota.examTitle === prova!.title,
      `nota ${nota.applicationId}: titulo bate com a prova`,
    );
    conferir(nota.className === turma!.name, `nota ${nota.applicationId}: turma bate`);
    conferir(nota.subject === turma!.subject, `nota ${nota.applicationId}: disciplina bate`);
    conferir(
      nota.teacherName === professorMock.fullName,
      `nota ${nota.applicationId}: professor bate`,
    );

    // RF07 permite publicar por versao: vale a versao que o estudante fez.
    const versaoDoAluno = versoes.get(correcao!.examVersionId);
    conferir(
      versaoDoAluno?.answerKeyPublished === nota.answerKeyPublished,
      `nota ${nota.applicationId}: answerKeyPublished bate com a versao do estudante`,
    );
  }

  return { verificacoes, falhas };
}
