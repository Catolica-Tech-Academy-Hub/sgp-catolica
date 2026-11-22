import type { LayoutDeBolhas, LeituraDaQuestao } from '../viabilidade/bolhas';
import type {
  ImagemRgba,
  MarcadoresDaFolha,
  Ponto,
  ResultadoDaDeteccao,
} from '../viabilidade/marcadores';
import type { MatrizHomografia, ResultadoDaPerspectiva } from '../viabilidade/perspectiva';
import type { QuestaoObjetivaParaConferir } from './estado-de-correcoes';

/**
 * Contrato entre a leitura do cartao-resposta e a conferencia objetiva (RF08, issue #98).
 *
 * A leitura so produz **sugestoes**. Nada aqui confirma correcao: quem aceita e o
 * professor, e a confirmacao continua sendo a da tela de notas. Este modulo nao importa
 * codigo em tempo de execucao, para as regras serem testadas sem o runtime do aparelho.
 */

export type EstadoDaSugestao = 'respondida' | 'em_branco' | 'multipla' | 'revisar';

export interface SugestaoDaQuestao {
  questionId: string;
  estado: EstadoDaSugestao;
  /** Presente somente quando a questao esta `respondida`. */
  alternativaSugeridaId?: string;
  /** Alternativas vistas como marcadas. Na dupla marcacao, nenhuma delas e escolhida. */
  alternativasDetectadasIds: string[];
}

export type MotivoDoBloqueio =
  | 'sem_fonte_de_imagem'
  | 'captura_falhou'
  | 'prova_incompativel'
  | 'marcadores_nao_encontrados'
  | 'perspectiva_invalida'
  | 'falha_inesperada';

export const MENSAGENS_DE_BLOQUEIO: Record<MotivoDoBloqueio, string> = {
  sem_fonte_de_imagem:
    'A captura pela câmera ainda não está disponível neste aplicativo. Continue a conferência pelo toque.',
  captura_falhou: 'Não foi possível obter a imagem do cartão. Tente de novo ou use o toque.',
  prova_incompativel:
    'O cartão provisório não comporta as questões desta prova. Continue a conferência pelo toque.',
  marcadores_nao_encontrados:
    'Os 4 marcadores de canto não foram encontrados. Enquadre a folha inteira e tente de novo.',
  perspectiva_invalida: 'A folha está inclinada demais para uma leitura segura. Tente de novo.',
  falha_inesperada:
    'A leitura falhou. Nenhuma marcação foi alterada. Tente de novo ou use o toque.',
};

export type ResultadoDaLeitura =
  { ok: true; sugestoes: SugestaoDaQuestao[] } | { ok: false; motivo: MotivoDoBloqueio };

/** Entrada de imagem. A camera real entra aqui, sem mudar a tela nem as regras. */
export type FonteDeImagem = () => Promise<ImagemRgba>;

/** Etapas do processamento, recebidas por parametro para o layout seguir provisorio. */
export interface NucleoDeLeitura {
  detectar(imagem: ImagemRgba): ResultadoDaDeteccao;
  calcularPerspectiva(marcadores: MarcadoresDaFolha): ResultadoDaPerspectiva;
  aplicarHomografia(matriz: MatrizHomografia, ponto: Ponto): Ponto;
  lerBolhas(
    imagem: ImagemRgba,
    projetar: (pontoMm: Ponto) => Ponto,
    layout: LayoutDeBolhas,
  ): LeituraDaQuestao[];
  criarLayout(opcoesPorQuestao: number[]): LayoutDeBolhas | undefined;
}

type QuestaoLida = Pick<QuestaoObjetivaParaConferir, 'questionId' | 'alternativas'>;

function interpretarQuestao(questao: QuestaoLida, leitura: LeituraDaQuestao): SugestaoDaQuestao {
  const idDaOpcao = (indice: number) => questao.alternativas[indice]?.id;
  const alternativasDetectadasIds = leitura.bolhas
    .filter((bolha) => bolha.estado === 'marcada')
    .flatMap((bolha) => idDaOpcao(bolha.indiceDaOpcao) ?? []);
  const base = { questionId: questao.questionId, alternativasDetectadasIds };

  if (leitura.estado === 'em_branco') return { ...base, estado: 'em_branco' };
  if (leitura.estado === 'multipla') return { ...base, estado: 'multipla' };
  if (leitura.estado === 'respondida' && leitura.indiceMarcado !== undefined) {
    const alternativaSugeridaId = idDaOpcao(leitura.indiceMarcado);
    if (alternativaSugeridaId) return { ...base, estado: 'respondida', alternativaSugeridaId };
  }
  return { ...base, estado: 'revisar' };
}

/** Traduz a posicao lida na folha para a alternativa impressa naquela versao. */
export function interpretarLeitura(
  questoes: QuestaoLida[],
  leituras: LeituraDaQuestao[],
): SugestaoDaQuestao[] | undefined {
  if (leituras.length !== questoes.length) return undefined;

  const sugestoes: SugestaoDaQuestao[] = [];
  for (let indice = 0; indice < questoes.length; indice += 1) {
    const leitura = leituras.find((item) => item.indiceDaQuestao === indice);
    if (!leitura) return undefined;
    sugestoes.push(interpretarQuestao(questoes[indice], leitura));
  }
  return sugestoes;
}

/** Executa o nucleo sobre uma imagem. Qualquer falha vira bloqueio, nunca uma resposta. */
export function lerCartao(
  imagem: ImagemRgba,
  questoes: QuestaoLida[],
  nucleo: NucleoDeLeitura,
): ResultadoDaLeitura {
  try {
    const layout = nucleo.criarLayout(questoes.map((questao) => questao.alternativas.length));
    if (!layout) return { ok: false, motivo: 'prova_incompativel' };

    const deteccao = nucleo.detectar(imagem);
    if (!deteccao.ok) return { ok: false, motivo: 'marcadores_nao_encontrados' };

    const perspectiva = nucleo.calcularPerspectiva(deteccao.marcadores);
    if (!perspectiva.ok) return { ok: false, motivo: 'perspectiva_invalida' };

    const leituras = nucleo.lerBolhas(
      imagem,
      (ponto) => nucleo.aplicarHomografia(perspectiva.folhaParaImagem, ponto),
      layout,
    );
    const sugestoes = interpretarLeitura(questoes, leituras);
    return sugestoes ? { ok: true, sugestoes } : { ok: false, motivo: 'prova_incompativel' };
  } catch {
    return { ok: false, motivo: 'falha_inesperada' };
  }
}

/** Obtem a imagem pela fonte disponivel e le o cartao, sem acesso a rede. */
export async function executarLeitura(
  fonte: FonteDeImagem | undefined,
  questoes: QuestaoLida[],
  nucleo: NucleoDeLeitura,
): Promise<ResultadoDaLeitura> {
  if (!fonte) return { ok: false, motivo: 'sem_fonte_de_imagem' };

  let imagem: ImagemRgba;
  try {
    imagem = await fonte();
  } catch {
    return { ok: false, motivo: 'captura_falhou' };
  }
  return lerCartao(imagem, questoes, nucleo);
}

// --- Decisao do professor -----------------------------------------------------------

/** O que a conferencia ja tem: letras tocadas e questoes aceitas como em branco. */
export interface MarcacoesDaConferencia {
  marcadas: Record<string, string>;
  emBranco: string[];
}

/** Escolha feita na revisao: id da alternativa, ou `null` para deixar em branco. */
export type RevisoesDaLeitura = Record<string, string | null>;

export type OrigemDaDecisao = 'revisao' | 'atual' | 'leitura' | 'pendente';

export interface ResolucaoDaQuestao {
  origem: OrigemDaDecisao;
  /** Id da alternativa, `null` para em branco, ausente enquanto estiver pendente. */
  valor?: string | null;
}

export function exigeRevisao({ estado }: SugestaoDaQuestao): boolean {
  return estado === 'multipla' || estado === 'revisar';
}

/**
 * Decide o valor de uma questao. A ordem e a regra: o toque na revisao vence a marcacao
 * atual, a marcacao atual vence a camera, e a camera so decide quando a leitura e segura.
 */
export function resolverQuestao(
  sugestao: SugestaoDaQuestao,
  atuais: MarcacoesDaConferencia,
  revisoes: RevisoesDaLeitura,
): ResolucaoDaQuestao {
  const { questionId } = sugestao;
  const revisao = revisoes[questionId];
  if (revisao !== undefined) return { origem: 'revisao', valor: revisao };

  const marcada = atuais.marcadas[questionId];
  if (marcada !== undefined) return { origem: 'atual', valor: marcada };
  if (atuais.emBranco.includes(questionId)) return { origem: 'atual', valor: null };

  if (exigeRevisao(sugestao)) return { origem: 'pendente' };
  return { origem: 'leitura', valor: sugestao.alternativaSugeridaId ?? null };
}

export function contarPendentes(
  sugestoes: SugestaoDaQuestao[],
  atuais: MarcacoesDaConferencia,
  revisoes: RevisoesDaLeitura,
): number {
  return sugestoes.filter(
    (sugestao) => resolverQuestao(sugestao, atuais, revisoes).origem === 'pendente',
  ).length;
}

/** Aceite do professor, levado de volta a conferencia pelos parametros da rota. */
export interface AplicacaoDaLeitura {
  /** Identifica este aceite, para ele nao ser aplicado duas vezes. */
  id: string;
  examVersionId: string;
  decisoes: { questionId: string; valor: string | null; origem: 'revisao' | 'leitura' }[];
}

/** Monta o aceite. Sem resolver todas as questoes em revisao, nao ha o que aplicar. */
export function montarAplicacao(
  id: string,
  examVersionId: string,
  sugestoes: SugestaoDaQuestao[],
  atuais: MarcacoesDaConferencia,
  revisoes: RevisoesDaLeitura,
): AplicacaoDaLeitura | undefined {
  if (contarPendentes(sugestoes, atuais, revisoes) > 0) return undefined;

  const decisoes = sugestoes.flatMap<AplicacaoDaLeitura['decisoes'][number]>((sugestao) => {
    const { origem, valor } = resolverQuestao(sugestao, atuais, revisoes);
    if ((origem !== 'revisao' && origem !== 'leitura') || valor === undefined) return [];
    return [{ questionId: sugestao.questionId, valor, origem }];
  });
  return { id, examVersionId, decisoes };
}

/**
 * Aplica o aceite sobre o estado da conferencia, sem mutar o original. Sugestao da camera
 * nunca sobrescreve o que ja foi decidido, e alternativa de outra questao e ignorada.
 */
export function aplicarNaConferencia(
  atuais: MarcacoesDaConferencia,
  aplicacao: AplicacaoDaLeitura,
  questoes: QuestaoLida[],
  examVersionId: string,
): MarcacoesDaConferencia {
  if (aplicacao.examVersionId !== examVersionId) return atuais;

  const marcadas = { ...atuais.marcadas };
  const emBranco = new Set(atuais.emBranco);

  for (const { questionId, valor, origem } of aplicacao.decisoes) {
    const questao = questoes.find((item) => item.questionId === questionId);
    if (!questao) continue;
    if (origem === 'leitura' && (marcadas[questionId] !== undefined || emBranco.has(questionId))) {
      continue;
    }
    if (valor === null) {
      delete marcadas[questionId];
      emBranco.add(questionId);
    } else if (questao.alternativas.some((alternativa) => alternativa.id === valor)) {
      marcadas[questionId] = valor;
      emBranco.delete(questionId);
    }
  }
  return { marcadas, emBranco: [...emBranco] };
}
