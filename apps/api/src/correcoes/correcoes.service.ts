import { Injectable } from '@nestjs/common';
import type { ItemFilaCorrecao } from '@sgp/shared-types';
import type { MotivoRevisao, Prisma } from '../generated/prisma/client';
import { ehViolacaoDeUnicidade } from '../prisma/erros';
import { PrismaService } from '../prisma/prisma.service';
import { GabaritoIndisponivelError, gabaritosEquivalentes } from './gabarito';
import {
  gabaritoDaVersao,
  incluirProvaParaGabarito,
  questoesParaGabarito,
} from './gabarito-do-banco';
import { type NotaCalculada, calcularNota, lerItem } from './regras';

/**
 * Resultado de um item do lote, com os nomes de `ItemFilaCorrecao` para o aplicativo
 * atualizar a fila direto. `reviewReason` vem quando a correcao entrou mas pede a
 * atencao do professor.
 */
export interface ResultadoDaSincronizacao {
  /** Ausente so quando o proprio item nao trouxe um identificador legivel. */
  clientCorrectionId?: string;
  syncStatus: 'synced' | 'error';
  correctionId?: string;
  totalScore?: number;
  reviewReason?: MotivoRevisao;
  syncError?: string;
}

const MENSAGEM_DE_DUPLICIDADE =
  'Ja existe correcao deste estudante nesta versao. A primeira foi mantida e marcada para revisao.';

type VersaoComProva = Prisma.VersaoProvaGetPayload<{
  include: { aplicacao: { include: { prova: { include: typeof incluirProvaParaGabarito } } } };
}>;

@Injectable()
export class CorrecoesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sincroniza a fila do aplicativo (RF08). Os itens sao tratados em ordem e cada um tem
   * o proprio resultado: um erro nao impede os demais. Reenviar um item ja registrado
   * devolve o mesmo resultado sem criar outro registro.
   */
  async sincronizarLote(
    professorId: string,
    itens: unknown[],
  ): Promise<ResultadoDaSincronizacao[]> {
    const resultados: ResultadoDaSincronizacao[] = [];
    for (const bruto of itens) resultados.push(await this.sincronizarItem(professorId, bruto));
    return resultados;
  }

  private async sincronizarItem(
    professorId: string,
    bruto: unknown,
  ): Promise<ResultadoDaSincronizacao> {
    const leitura = lerItem(bruto);
    if (!leitura.ok) {
      const id = (bruto as { clientCorrectionId?: unknown } | null)?.clientCorrectionId;
      return {
        clientCorrectionId: typeof id === 'string' ? id : undefined,
        syncStatus: 'error',
        syncError: leitura.motivo,
      };
    }
    const item = leitura.valor;
    const erro = (syncError: string): ResultadoDaSincronizacao => ({
      clientCorrectionId: item.clientCorrectionId,
      syncStatus: 'error',
      syncError,
    });

    const jaRegistrada = await this.resultadoDoReenvio(professorId, item.clientCorrectionId);
    if (jaRegistrada) return jaRegistrada;

    const versao = await this.prisma.versaoProva.findFirst({
      where: { id: item.examVersionId, aplicacao: { teacherId: professorId } },
      include: { aplicacao: { include: { prova: { include: incluirProvaParaGabarito } } } },
    });
    if (!versao) return erro('Versao nao encontrada.');

    const problemaDeIdentificacao = await this.problemaDeIdentificacao(versao, item);
    if (problemaDeIdentificacao) return erro(problemaDeIdentificacao);

    if (!snapshotSegueAFolha(versao, item)) {
      return erro('A copia do gabarito nao corresponde a folha impressa desta versao.');
    }

    const nota = calcularNota(item);
    if (!nota.ok) return erro(nota.motivo);

    if (item.studentId && (await this.sinalizarDuplicidade(versao.id, item.studentId))) {
      return erro(MENSAGEM_DE_DUPLICIDADE);
    }

    const reviewReason = this.gabaritoMudou(versao, item) ? 'answer_key_changed' : undefined;
    try {
      const correcao = await this.prisma.correcao.create({
        data: dadosDaCorrecao(professorId, item, nota.valor, reviewReason),
        select: { id: true },
      });
      return {
        clientCorrectionId: item.clientCorrectionId,
        syncStatus: 'synced',
        correctionId: correcao.id,
        totalScore: nota.valor.totalScore,
        reviewReason,
      };
    } catch (falha) {
      if (!ehViolacaoDeUnicidade(falha)) throw falha;
      // Outro envio gravou no meio do caminho: o mesmo item (reenvio) ou o mesmo aluno.
      const reenvio = await this.resultadoDoReenvio(professorId, item.clientCorrectionId);
      if (reenvio) return reenvio;
      if (item.studentId) await this.sinalizarDuplicidade(versao.id, item.studentId);
      return erro(MENSAGEM_DE_DUPLICIDADE);
    }
  }

  /**
   * Item ja registrado: responde como sincronizado, com o que foi gravado da primeira vez.
   * Um `clientCorrectionId` de outro professor nao e revelado.
   */
  private async resultadoDoReenvio(
    professorId: string,
    clientCorrectionId: string,
  ): Promise<ResultadoDaSincronizacao | undefined> {
    const existente = await this.prisma.correcao.findUnique({
      where: { clientCorrectionId },
      select: {
        id: true,
        totalScore: true,
        reviewReason: true,
        versao: { select: { aplicacao: { select: { teacherId: true } } } },
      },
    });
    if (!existente) return undefined;
    if (existente.versao.aplicacao.teacherId !== professorId) {
      return {
        clientCorrectionId,
        syncStatus: 'error',
        syncError: 'Identificador de correcao ja usado. Gere um novo e reenvie.',
      };
    }
    return {
      clientCorrectionId,
      syncStatus: 'synced',
      correctionId: existente.id,
      totalScore: Number(existente.totalScore),
      reviewReason: existente.reviewReason ?? undefined,
    };
  }

  /**
   * Com identificacao, o estudante e o do QR Code e precisa ter recebido esta versao. Sem
   * identificacao, a nota nao e atribuida aqui: fica para o lancamento manual (RF09), com
   * nome e matricula lidos na folha so como apoio.
   */
  private async problemaDeIdentificacao(
    versao: VersaoComProva,
    item: ItemFilaCorrecao,
  ): Promise<string | undefined> {
    if (!versao.withStudentIdentification) {
      return item.studentId
        ? 'Prova sem identificacao nao atribui a nota ao estudante; use o lancamento manual.'
        : undefined;
    }
    if (!item.studentId) return 'Prova com identificacao precisa do estudante lido no QR Code.';
    const atribuicao = await this.prisma.atribuicaoVersao.findFirst({
      where: { examVersionId: versao.id, studentId: item.studentId },
      select: { id: true },
    });
    return atribuicao ? undefined : 'O estudante nao recebeu esta versao da prova.';
  }

  /**
   * Ja existe correcao deste estudante nesta versao: a primeira fica, e e ela que recebe a
   * marca de revisao. Nunca sobrescreve em silencio (RF08).
   */
  private async sinalizarDuplicidade(examVersionId: string, studentId: string): Promise<boolean> {
    const { count } = await this.prisma.correcao.updateMany({
      where: { examVersionId, studentId },
      data: { reviewReason: 'duplicate_submission' },
    });
    return count > 0;
  }

  /** Sem gabarito atual montavel (a prova mudou), conta como mudanca tambem. */
  private gabaritoMudou(versao: VersaoComProva, item: ItemFilaCorrecao): boolean {
    try {
      const atual = gabaritoDaVersao(
        versao,
        questoesParaGabarito(versao.aplicacao.prova),
        new Date(),
      );
      return !gabaritosEquivalentes(atual, item.answerKeySnapshot);
    } catch (erro) {
      if (erro instanceof GabaritoIndisponivelError) return true;
      throw erro;
    }
  }
}

/** As questoes do snapshot precisam ser exatamente as impressas nesta versao. */
function snapshotSegueAFolha(versao: VersaoComProva, item: ItemFilaCorrecao): boolean {
  const impressas = new Set((versao.layout as { questionOrder?: string[] }).questionOrder ?? []);
  const doSnapshot = [
    ...item.answerKeySnapshot.objectiveQuestions,
    ...item.answerKeySnapshot.discursiveQuestions,
  ].map((questao) => questao.questionId);
  return doSnapshot.length === impressas.size && doSnapshot.every((id) => impressas.has(id));
}

function dadosDaCorrecao(
  professorId: string,
  item: ItemFilaCorrecao,
  nota: NotaCalculada,
  reviewReason: MotivoRevisao | undefined,
): Prisma.CorrecaoUncheckedCreateInput {
  return {
    examVersionId: item.examVersionId,
    studentId: item.studentId ?? null,
    reportedStudentName: item.studentId ? null : (item.reportedStudentName ?? null),
    reportedStudentRegistration: item.studentId ? null : (item.reportedStudentRegistration ?? null),
    // Copias planas: o tipo de entrada JSON do Prisma nao aceita interfaces nomeadas.
    objectiveResults: nota.objectiveResults.map((resultado) => ({ ...resultado })),
    discursiveScores: nota.discursiveScores.map((resultado) => ({ ...resultado })),
    totalScore: nota.totalScore,
    confirmedAt: new Date(item.capturedAt),
    correctedBy: professorId,
    isAutomaticallyAssigned: Boolean(item.studentId),
    clientCorrectionId: item.clientCorrectionId,
    syncStatus: 'synced',
    answerKeySnapshot: JSON.parse(JSON.stringify(item.answerKeySnapshot)) as Prisma.InputJsonValue,
    reviewReason: reviewReason ?? null,
  };
}
