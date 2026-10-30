import { useEffect, useState } from 'react';
import {
  aplicacoesMock,
  atribuicoesMock,
  correcoesMock,
  estudantesMock,
  filaCorrecoesMock,
  provasMock,
  questoesMock,
  turmasMock,
  versoesMock,
} from '@sgp/mocks';
import type { ItemFilaCorrecao, NotaDiscursiva, StatusSincronizacao } from '@sgp/shared-types';

/**
 * Estado do fluxo de correcao do aplicativo do professor (RF08).
 *
 * Mesmo papel dos `apps/web/src/lib/estado-de-*.ts`: um modulo unico e reativo, semeado
 * pelos mocks, que e o ponto de integracao a substituir quando a API existir. Nenhuma
 * tela deve importar `@sgp/mocks` para **alterar** algo — ler dado derivado por aqui.
 *
 * Diferente da web, nao ha `localStorage`: a persistencia real da fila (RF08 exige que
 * ela sobreviva ao fechamento do aplicativo) depende de armazenamento do dispositivo,
 * que e trabalho de uma fase com backend. Aqui a fila vive na memoria da sessao, e a
 * tela de fila diz isso com todas as letras em vez de simular sincronizacao.
 */

/** Assinantes das mudancas. Um `useState` por tela, sem biblioteca de estado. */
const assinantes = new Set<() => void>();

function notificar(): void {
  for (const assinante of assinantes) assinante();
}

/**
 * Liga um componente ao estado do modulo.
 *
 * Substitui o `reactive` do Vue: o React nao tem reatividade automatica, entao cada tela
 * assina as mudancas e re-renderiza. E deliberadamente simples — a alternativa seria
 * trazer um gerenciador de estado para a fase que menos precisa dele.
 */
export function useEstadoDeCorrecoes(): number {
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    const assinante = () => setVersao((atual) => atual + 1);
    assinantes.add(assinante);
    return () => {
      assinantes.delete(assinante);
    };
  }, []);

  return versao;
}

// --- Aplicacoes a corrigir ---------------------------------------------------------

export interface AplicacaoParaCorrigir {
  id: string;
  tituloDaProva: string;
  nomeDaTurma: string;
  disciplina: string;
  /** Provas impressas desta aplicacao que ainda nao foram corrigidas. */
  pendentes: number;
  totalDeProvas: number;
  criadaEm: string;
}

/**
 * Aplicacoes com PDF gerado, que sao as unicas que existem em papel para corrigir.
 *
 * "Pendentes" e a diferenca entre as provas impressas e as correcoes ja confirmadas
 * daquela versao. Para prova com identificacao, o total impresso e o numero de
 * atribuicoes; para prova anonima nao existe atribuicao, entao o total impresso e
 * desconhecido e a tela nao promete um numero que nao tem.
 */
export function listarAplicacoesGeradas(): AplicacaoParaCorrigir[] {
  return aplicacoesMock
    .filter((aplicacao) => aplicacao.status === 'generated')
    .map((aplicacao) => {
      const prova = provasMock.find((item) => item.id === aplicacao.examId);
      const turma = turmasMock.find((item) => item.id === aplicacao.classId);
      const versoes = versoesMock.filter((versao) => versao.applicationId === aplicacao.id);

      const totalDeProvas = versoes.reduce(
        (total, versao) =>
          total + atribuicoesMock.filter((item) => item.examVersionId === versao.id).length,
        0,
      );
      const corrigidas = versoes.reduce(
        (total, versao) =>
          total + correcoesConfirmadas().filter((item) => item.examVersionId === versao.id).length,
        0,
      );

      return {
        id: aplicacao.id,
        tituloDaProva: prova?.title ?? 'Prova indisponivel',
        nomeDaTurma: turma?.name ?? 'Turma indisponivel',
        disciplina: turma?.subject ?? '',
        pendentes: Math.max(0, totalDeProvas - corrigidas),
        totalDeProvas,
        criadaEm: aplicacao.createdAt,
      };
    })
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
}

// --- Atribuicoes de uma aplicacao (o que o QR Code identificaria) -------------------

export interface AtribuicaoParaCorrigir {
  id: string;
  examVersionId: string;
  versionNumber: number;
  studentId?: string;
  nomeDoAluno: string;
  matricula?: string;
  /** true quando a prova daquele aluno ja tem correcao confirmada. */
  jaCorrigida: boolean;
  comIdentificacao: boolean;
}

/**
 * O que o professor escolhe na tela de selecao, no lugar de ler o QR Code de verdade.
 *
 * A leitura real de camera pertence a uma fase futura (nao vale na N1), mas o **efeito**
 * da leitura e este: chegar a uma versao e, quando a prova tem identificacao, a um aluno.
 */
export function listarAtribuicoesDaAplicacao(applicationId: string): AtribuicaoParaCorrigir[] {
  const versoes = versoesMock.filter((versao) => versao.applicationId === applicationId);

  return versoes.flatMap<AtribuicaoParaCorrigir>((versao) => {
    if (!versao.withStudentIdentification) {
      // Prova anonima: o QR Code identifica so a versao, entao ha uma unica entrada.
      return [
        {
          id: `anonima-${versao.id}`,
          examVersionId: versao.id,
          versionNumber: versao.versionNumber,
          nomeDoAluno: 'Prova sem identificacao',
          jaCorrigida: false,
          comIdentificacao: false,
        },
      ];
    }

    return atribuicoesMock
      .filter((atribuicao) => atribuicao.examVersionId === versao.id)
      .map((atribuicao) => {
        const estudante = estudantesMock.find((item) => item.id === atribuicao.studentId);
        return {
          id: atribuicao.id,
          examVersionId: versao.id,
          versionNumber: versao.versionNumber,
          studentId: atribuicao.studentId,
          nomeDoAluno: estudante?.fullName ?? 'Aluno indisponivel',
          matricula: estudante?.registration,
          jaCorrigida: correcoesConfirmadas().some(
            (correcao) =>
              correcao.examVersionId === versao.id && correcao.studentId === atribuicao.studentId,
          ),
          comIdentificacao: true,
        };
      });
  });
}

// --- Gabarito local -----------------------------------------------------------------

/**
 * Copia local do gabarito daquela versao.
 *
 * RF08 e categorico: **sem copia local do gabarito, o aplicativo nao permite confirmar a
 * correcao**. Na N1 a copia vem dos mocks, mas a regra e respeitada de verdade — quem
 * nao encontrar gabarito aqui nao consegue avancar na tela de conferencia.
 */
export function obterGabaritoDaVersao(examVersionId: string) {
  return filaCorrecoesMock.find((item) => item.examVersionId === examVersionId)?.answerKeySnapshot;
}

// --- Prova a corrigir (conferencia objetiva e notas discursivas) --------------------

const LETRAS = ['A', 'B', 'C', 'D', 'E'];

export interface QuestaoObjetivaParaConferir {
  questionId: string;
  /** Numero impresso naquela versao (posicao em `layout.questionOrder`). */
  numero: number;
  enunciado?: string;
  pontuacao: number;
  correctAlternativeId: string;
  /** Alternativas na ordem impressa, ja com a letra que o aluno viu na folha. */
  alternativas: { id: string; letra: string }[];
}

export interface QuestaoDiscursivaParaCorrigir {
  questionId: string;
  numero: number;
  enunciado?: string;
  maxScore: number;
}

export interface ProvaParaCorrigir {
  examVersionId: string;
  versionNumber: number;
  comIdentificacao: boolean;
  objetivas: QuestaoObjetivaParaConferir[];
  discursivas: QuestaoDiscursivaParaCorrigir[];
  /** Soma da pontuacao das objetivas: o teto da nota objetiva. */
  maximoObjetivo: number;
  /** Soma dos `maxScore` das discursivas. */
  maximoDiscursivo: number;
}

/**
 * Junta o que as telas de conferencia e de notas precisam de uma versao.
 *
 * Pontuacao, alternativa correta e `maxScore` vem **da copia local do gabarito**, e nao
 * do cadastro da questao: e o gabarito que vai junto do item da fila e que o servidor usa
 * para recalcular (RF08). O enunciado nao faz parte do gabarito, entao vem do banco de
 * questoes pelo `questionId`; o numero da questao e a posicao impressa naquela versao.
 *
 * Devolve `undefined` quando nao ha copia local do gabarito — a situacao em que RF08
 * proibe confirmar a correcao.
 */
export function obterProvaParaCorrigir(examVersionId: string): ProvaParaCorrigir | undefined {
  const gabarito = obterGabaritoDaVersao(examVersionId);
  const versao = versoesMock.find((item) => item.id === examVersionId);
  if (!gabarito || !versao) return undefined;

  const ordemImpressa = versao.layout.questionOrder;
  const numeroDa = (questionId: string) => ordemImpressa.indexOf(questionId) + 1;
  const enunciadoDa = (questionId: string) =>
    questoesMock.find((questao) => questao.id === questionId)?.statement;

  const objetivas = gabarito.objectiveQuestions
    .map((questao) => ({
      questionId: questao.questionId,
      numero: numeroDa(questao.questionId),
      enunciado: enunciadoDa(questao.questionId),
      pontuacao: questao.score,
      correctAlternativeId: questao.correctAlternativeId,
      alternativas: questao.printedOrder.map((id, indice) => ({ id, letra: LETRAS[indice] })),
    }))
    .sort((a, b) => a.numero - b.numero);

  const discursivas = gabarito.discursiveQuestions
    .map((questao) => ({
      questionId: questao.questionId,
      numero: numeroDa(questao.questionId),
      enunciado: enunciadoDa(questao.questionId),
      maxScore: questao.maxScore,
    }))
    .sort((a, b) => a.numero - b.numero);

  return {
    examVersionId,
    versionNumber: versao.versionNumber,
    comIdentificacao: versao.withStudentIdentification,
    objetivas,
    discursivas,
    maximoObjetivo: somar(objetivas.map((questao) => questao.pontuacao)),
    maximoDiscursivo: somar(discursivas.map((questao) => questao.maxScore)),
  };
}

/** Respostas marcadas na folha: alternativa escolhida por questao objetiva. */
export type RespostasObjetivas = { questionId: string; selectedAlternativeId: string }[];

/**
 * Nota objetiva: soma a pontuacao das questoes em que a alternativa marcada e a correta
 * do gabarito. Questao sem marcacao nao pontua.
 */
export function calcularNotaObjetiva(prova: ProvaParaCorrigir, respostas: RespostasObjetivas) {
  return somar(
    prova.objetivas
      .filter((questao) =>
        respostas.some(
          (resposta) =>
            resposta.questionId === questao.questionId &&
            resposta.selectedAlternativeId === questao.correctAlternativeId,
        ),
      )
      .map((questao) => questao.pontuacao),
  );
}

/** Nota total da prova (RF08): nota objetiva + soma das notas discursivas. */
export function calcularNotaTotal(notaObjetiva: number, notasDiscursivas: NotaDiscursiva[]) {
  return somar([notaObjetiva, ...notasDiscursivas.map((nota) => nota.score)]);
}

/**
 * Le a nota digitada. Aceita virgula ou ponto, porque o teclado numerico brasileiro
 * digita virgula. Devolve `undefined` quando o texto nao e um numero.
 */
export function lerNota(texto: string): number | undefined {
  const limpo = texto.trim().replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(limpo)) return undefined;
  return Number(limpo);
}

/**
 * Valida a nota de uma questao discursiva contra o `maxScore` daquela versao.
 * Devolve a mensagem de erro, ou `undefined` quando a nota e valida.
 */
export function validarNotaDiscursiva(texto: string, maxScore: number): string | undefined {
  if (texto.trim() === '') return 'Informe a nota desta questão.';
  const nota = lerNota(texto);
  if (nota === undefined) return 'Use apenas números, com até duas casas decimais (ex.: 1,5).';
  if (nota < 0) return 'A nota não pode ser negativa.';
  if (nota > maxScore) return `A nota não pode passar de ${formatarNota(maxScore)}.`;
  return undefined;
}

/**
 * Formato de nota em pt-BR, igual ao `formatarPontos` da web (uma casa decimal fixa),
 * mas aceitando a segunda casa que a validacao permite — senao 1,25 apareceria como 1,3.
 */
const formatadorDeNota = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

export function formatarNota(nota: number): string {
  return formatadorDeNota.format(nota);
}

/** Soma arredondada em centesimos, para 0,1 + 0,2 nao virar 0,30000000000000004. */
function somar(valores: number[]): number {
  return Math.round(valores.reduce((total, valor) => total + valor, 0) * 100) / 100;
}

// --- Fila local ---------------------------------------------------------------------

/** A fila comeca com os itens de demonstracao e recebe o que for corrigido na sessao. */
const fila: ItemFilaCorrecao[] = filaCorrecoesMock.map((item) => ({ ...item }));

export function listarFila(): ItemFilaCorrecao[] {
  return [...fila].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export function totalPorStatus(): Record<StatusSincronizacao, number> {
  return {
    pending: fila.filter((item) => item.syncStatus === 'pending').length,
    synced: fila.filter((item) => item.syncStatus === 'synced').length,
    error: fila.filter((item) => item.syncStatus === 'error').length,
  };
}

/** Correcoes que contam como "ja corrigida": as dos mocks e as confirmadas na sessao. */
function correcoesConfirmadas(): { examVersionId: string; studentId?: string }[] {
  return [
    ...correcoesMock.map((item) => ({
      examVersionId: item.examVersionId,
      studentId: item.studentId,
    })),
    ...fila
      .filter(
        (item) => !filaCorrecoesMock.some((m) => m.clientCorrectionId === item.clientCorrectionId),
      )
      .map((item) => ({ examVersionId: item.examVersionId, studentId: item.studentId })),
  ];
}

export interface CorrecaoParaConfirmar {
  examVersionId: string;
  studentId?: string;
  reportedStudentName?: string;
  reportedStudentRegistration?: string;
  objectiveAnswers: { questionId: string; selectedAlternativeId: string }[];
  discursiveScores: NotaDiscursiva[];
}

/**
 * Coloca a correcao na fila local.
 *
 * RF08 manda salvar **primeiro** no dispositivo, com ou sem internet, e deduplicar por
 * um identificador gerado no proprio aparelho. O `clientCorrectionId` cumpre esse papel;
 * reenviar o mesmo item nao cria um segundo registro.
 *
 * Devolve `undefined` quando nao ha copia local do gabarito — a situacao em que RF08
 * proibe confirmar.
 */
export function enfileirarCorrecao(dados: CorrecaoParaConfirmar): ItemFilaCorrecao | undefined {
  const answerKeySnapshot = obterGabaritoDaVersao(dados.examVersionId);
  if (!answerKeySnapshot) return undefined;

  const item: ItemFilaCorrecao = {
    clientCorrectionId: gerarIdentificadorLocal(),
    examVersionId: dados.examVersionId,
    studentId: dados.studentId,
    reportedStudentName: dados.reportedStudentName,
    reportedStudentRegistration: dados.reportedStudentRegistration,
    objectiveAnswers: dados.objectiveAnswers,
    discursiveScores: dados.discursiveScores,
    answerKeySnapshot,
    capturedAt: new Date().toISOString(),
    // Nasce pendente: nada foi enviado, e chamar isso de "sincronizado" seria mentir.
    syncStatus: 'pending',
  };

  fila.unshift(item);
  notificar();
  return item;
}

/**
 * Identificador gerado no dispositivo, para a deduplicacao idempotente do RF08.
 *
 * Nao usa `crypto.randomUUID`: ele nao existe no runtime do React Native sem polyfill.
 * A combinacao de tempo e aleatorio basta para a fase N1, onde nada e enviado.
 */
function gerarIdentificadorLocal(): string {
  const aleatorio = Math.random().toString(36).slice(2, 10);
  return `local-${Date.now().toString(36)}-${aleatorio}`;
}

/** Descarta o que foi corrigido na sessao e volta a fila de demonstracao. */
export function reiniciarComOsMocks(): void {
  fila.splice(0, fila.length, ...filaCorrecoesMock.map((item) => ({ ...item })));
  notificar();
}
