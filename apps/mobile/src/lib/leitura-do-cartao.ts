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
  /** Ha marca em uma bolha alem das alternativas desta questao: exige revisao manual. */
  marcaExcedente?: boolean;
}

export type MotivoDoBloqueio =
  | 'sem_fonte_de_imagem'
  | 'captura_falhou'
  | 'prova_incompativel'
  | 'marcadores_nao_encontrados'
  | 'perspectiva_invalida'
  | 'falha_inesperada';

export const MENSAGENS_DE_BLOQUEIO: Record<MotivoDoBloqueio, string> = {
  sem_fonte_de_imagem: 'Nenhuma foto do cartão foi recebida. Tente de novo ou use o toque.',
  captura_falhou: 'Não foi possível obter a imagem do cartão. Tente de novo ou use o toque.',
  prova_incompativel:
    'O cartão provisório não comporta as questões desta prova. Continue a conferência pelo toque.',
  marcadores_nao_encontrados:
    'Os 4 marcadores de canto não foram encontrados. Enquadre a folha inteira e tente de novo.',
  perspectiva_invalida: 'A folha está inclinada demais para uma leitura segura. Tente de novo.',
  falha_inesperada:
    'A leitura falhou. Nenhuma marcação foi alterada. Tente de novo ou use o toque.',
};

/** Area entre os centros dos 4 marcadores, em pixels da imagem lida. */
export interface AreaDetectada {
  largura: number;
  altura: number;
  /** Sentido horario, a partir do canto superior esquerdo da folha. */
  cantos: [Ponto, Ponto, Ponto, Ponto];
}

export type ResultadoDaLeitura =
  | { ok: true; sugestoes: SugestaoDaQuestao[]; areaDetectada: AreaDetectada }
  | { ok: false; motivo: MotivoDoBloqueio };

/** Entrada de imagem da leitura: a foto capturada pela camera. */
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

  // Vem antes dos demais estados: B + E numa questao de 4 alternativas nunca vira resposta B.
  const marcaExcedente = leitura.bolhas.some(
    (bolha) => bolha.estado === 'marcada' && bolha.indiceDaOpcao >= questao.alternativas.length,
  );
  if (marcaExcedente) return { ...base, estado: 'revisar', marcaExcedente };

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
    if (!sugestoes) return { ok: false, motivo: 'prova_incompativel' };

    const { superiorEsquerdo, superiorDireito, inferiorDireito, inferiorEsquerdo } =
      deteccao.marcadores;
    return {
      ok: true,
      sugestoes,
      areaDetectada: {
        largura: imagem.largura,
        altura: imagem.altura,
        cantos: [
          superiorEsquerdo.centro,
          superiorDireito.centro,
          inferiorDireito.centro,
          inferiorEsquerdo.centro,
        ],
      },
    };
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
  /** Questoes cujo valor atual veio de uma leitura aceita, sem toque do professor. */
  sugeridasPelaLeitura: string[];
  /**
   * Questoes em que uma nova leitura divergiu da sugestao anterior, com o valor sugerido
   * antes. Ficam sem resposta ate o professor decidir por toque.
   */
  divergentes: Record<string, string | null>;
}

/** Divergencias de uma leitura concluida, registradas na conferencia ao fim da leitura. */
export interface DivergenciasDaLeitura {
  /** Identifica esta leitura, para o registro nao ser repetido. */
  id: string;
  examVersionId: string;
  valoresAnteriores: Record<string, string | null>;
}

/** Escolha feita na revisao: id da alternativa, ou `null` para deixar em branco. */
export type RevisoesDaLeitura = Record<string, string | null>;

export type OrigemDaDecisao = 'revisao' | 'atual' | 'leitura' | 'pendente';

export interface ResolucaoDaQuestao {
  origem: OrigemDaDecisao;
  /** Id da alternativa, `null` para em branco, ausente enquanto estiver pendente. */
  valor?: string | null;
  /** Sugestao de uma leitura anterior que esta leitura nao confirmou. */
  valorAnterior?: string | null;
}

export function exigeRevisao({ estado }: SugestaoDaQuestao): boolean {
  return estado === 'multipla' || estado === 'revisar';
}

function valorNaConferencia(
  atuais: MarcacoesDaConferencia,
  questionId: string,
): string | null | undefined {
  const marcada = atuais.marcadas[questionId];
  if (marcada !== undefined) return marcada;
  return atuais.emBranco.includes(questionId) ? null : undefined;
}

/** Valor que a leitura decide sozinha, ou `undefined` quando ela exige revisao. */
function valorSeguroDaLeitura(sugestao: SugestaoDaQuestao): string | null | undefined {
  if (sugestao.estado === 'em_branco') return null;
  return sugestao.estado === 'respondida' ? sugestao.alternativaSugeridaId : undefined;
}

/**
 * Decide o valor de uma questao. O toque do professor vence qualquer leitura. Uma sugestao
 * aplicada antes nao e decisao dele: so se mantem quando a nova leitura segura a confirma,
 * e qualquer divergencia volta para revisao, sem trocar nem manter o valor em silencio.
 */
export function resolverQuestao(
  sugestao: SugestaoDaQuestao,
  atuais: MarcacoesDaConferencia,
  revisoes: RevisoesDaLeitura,
): ResolucaoDaQuestao {
  const { questionId } = sugestao;
  const revisao = revisoes[questionId];
  if (revisao !== undefined) return { origem: 'revisao', valor: revisao };

  // Divergencia ja registrada so se resolve por decisao do professor, nunca por outra leitura.
  const divergencia = atuais.divergentes[questionId];
  if (divergencia !== undefined) return { origem: 'pendente', valorAnterior: divergencia };

  const valorAtual = valorNaConferencia(atuais, questionId);
  const valorLido = valorSeguroDaLeitura(sugestao);
  if (valorAtual === undefined) {
    return valorLido === undefined
      ? { origem: 'pendente' }
      : { origem: 'leitura', valor: valorLido };
  }

  if (!atuais.sugeridasPelaLeitura.includes(questionId) || valorLido === valorAtual) {
    return { origem: 'atual', valor: valorAtual };
  }
  return { origem: 'pendente', valorAnterior: valorAtual };
}

/** A leitura atual repete a sugestao anterior, mas a divergencia registrada segue pendente. */
export function leituraConfirmaSugestaoAnterior(
  sugestao: SugestaoDaQuestao,
  { origem, valorAnterior }: ResolucaoDaQuestao,
): boolean {
  return (
    origem === 'pendente' &&
    valorAnterior !== undefined &&
    valorSeguroDaLeitura(sugestao) === valorAnterior
  );
}

/**
 * Rotulo de uma questao pendente cuja leitura atual e segura. Sem leitura segura devolve
 * `undefined`, e a tela usa o rotulo do proprio estado (dupla marcacao ou leitura incerta).
 */
export function rotuloDaPendencia(
  sugestao: SugestaoDaQuestao,
  resolucao: ResolucaoDaQuestao,
): string | undefined {
  if (resolucao.origem !== 'pendente' || exigeRevisao(sugestao)) return undefined;
  return leituraConfirmaSugestaoAnterior(sugestao, resolucao)
    ? 'Revisar: decisão pendente'
    : 'Revisar: difere da leitura anterior';
}

/**
 * Rotulo da decisao do professor quando ela difere da leitura atual, para o selo mostrar o
 * que esta valendo. Quando os dois coincidem, ou nao ha decisao, devolve `undefined`.
 */
export function rotuloDaDecisaoManual(
  sugestao: SugestaoDaQuestao,
  { origem, valor }: ResolucaoDaQuestao,
  valorDescrito: string,
): string | undefined {
  if (origem !== 'atual' && origem !== 'revisao') return undefined;
  return valor === valorSeguroDaLeitura(sugestao) ? undefined : `Decisão manual: ${valorDescrito}`;
}

export function mensagemDeSugestaoRepetida(valor: string): string {
  return `Esta leitura voltou a sugerir ${valor}, mas uma leitura anterior divergiu. Escolha a resposta ou deixe em branco.`;
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

/** Questoes cuja sugestao anterior nao foi confirmada por esta leitura. */
export function listarDivergencias(
  sugestoes: SugestaoDaQuestao[],
  atuais: MarcacoesDaConferencia,
): Record<string, string | null> {
  const valores: Record<string, string | null> = {};
  for (const sugestao of sugestoes) {
    const { origem, valorAnterior } = resolverQuestao(sugestao, atuais, {});
    if (origem === 'pendente' && valorAnterior !== undefined) {
      valores[sugestao.questionId] = valorAnterior;
    }
  }
  return valores;
}

/**
 * Tira da conferencia as sugestoes que a nova leitura nao confirmou, para a divergencia
 * continuar pendente mesmo que o professor saia sem aplicar. Decisao manual nao e afetada.
 */
export function marcarDivergencias(
  atuais: MarcacoesDaConferencia,
  { examVersionId, valoresAnteriores }: DivergenciasDaLeitura,
  examVersionIdDaConferencia: string,
): MarcacoesDaConferencia {
  if (examVersionId !== examVersionIdDaConferencia) return atuais;

  const marcadas = { ...atuais.marcadas };
  const emBranco = new Set(atuais.emBranco);
  const sugeridas = new Set(atuais.sugeridasPelaLeitura);
  const divergentes = { ...atuais.divergentes };

  for (const [questionId, valorAnterior] of Object.entries(valoresAnteriores)) {
    if (divergentes[questionId] !== undefined || !sugeridas.has(questionId)) continue;
    delete marcadas[questionId];
    emBranco.delete(questionId);
    sugeridas.delete(questionId);
    divergentes[questionId] = valorAnterior;
  }
  return { marcadas, emBranco: [...emBranco], sugeridasPelaLeitura: [...sugeridas], divergentes };
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
  const sugeridas = new Set(atuais.sugeridasPelaLeitura);
  const divergentes = { ...atuais.divergentes };

  for (const { questionId, valor, origem } of aplicacao.decisoes) {
    const questao = questoes.find((item) => item.questionId === questionId);
    if (!questao) continue;
    const jaDecidida =
      marcadas[questionId] !== undefined ||
      emBranco.has(questionId) ||
      divergentes[questionId] !== undefined;
    if (origem === 'leitura' && jaDecidida) continue;
    if (valor === null) {
      delete marcadas[questionId];
      emBranco.add(questionId);
    } else if (questao.alternativas.some((alternativa) => alternativa.id === valor)) {
      marcadas[questionId] = valor;
      emBranco.delete(questionId);
    } else {
      continue;
    }
    if (origem === 'leitura') sugeridas.add(questionId);
    else sugeridas.delete(questionId);
    delete divergentes[questionId];
  }
  return { marcadas, emBranco: [...emBranco], sugeridasPelaLeitura: [...sugeridas], divergentes };
}

/** Toque na conferencia: vira decisao do professor, mesmo sobre uma sugestao da leitura. */
export function registrarToque(
  atuais: MarcacoesDaConferencia,
  questionId: string,
  alternativaId: string,
): MarcacoesDaConferencia {
  const divergentes = { ...atuais.divergentes };
  delete divergentes[questionId];
  return {
    marcadas: { ...atuais.marcadas, [questionId]: alternativaId },
    emBranco: atuais.emBranco.filter((id) => id !== questionId),
    sugeridasPelaLeitura: atuais.sugeridasPelaLeitura.filter((id) => id !== questionId),
    divergentes,
  };
}

/** Decisao manual de deixar a questao em branco, que nenhuma leitura futura sobrescreve. */
export function registrarBranco(
  atuais: MarcacoesDaConferencia,
  questionId: string,
): MarcacoesDaConferencia {
  const marcadas = { ...atuais.marcadas };
  const divergentes = { ...atuais.divergentes };
  delete marcadas[questionId];
  delete divergentes[questionId];
  return {
    marcadas,
    emBranco: [...atuais.emBranco.filter((id) => id !== questionId), questionId],
    sugeridasPelaLeitura: atuais.sugeridasPelaLeitura.filter((id) => id !== questionId),
    divergentes,
  };
}
