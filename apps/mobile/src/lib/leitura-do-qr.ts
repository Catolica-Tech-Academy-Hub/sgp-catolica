/**
 * Validacao do QR Code impresso na prova (RF08, issue #97).
 *
 * O conteudo do QR e um valor opaco: o formato definitivo pertence a issue #91, entao aqui
 * ele so e comparado, por igualdade exata, com os dados locais. A leitura identifica a prova
 * e nunca confirma uma correcao.
 */

/** Tamanho da coluna `qrCodePayload` no banco. Acima disso o valor nao e um QR do sistema. */
const TAMANHO_MAXIMO_DO_QR = 255;

/** Uma prova impressa que pode ser reconhecida pelo QR. */
export interface EntradaDoQr {
  qrCodePayload: string;
  applicationId: string;
  examVersionId: string;
  /** Ausente na prova sem identificacao: o QR identifica somente a versao. */
  studentId?: string;
  nomeDoAluno: string;
  jaCorrigida: boolean;
  temGabarito: boolean;
}

export type MotivoDoQrInvalido =
  'ilegivel' | 'nao_reconhecido' | 'outra_aplicacao' | 'ja_corrigida' | 'sem_gabarito';

export const MENSAGENS_DO_QR: Record<MotivoDoQrInvalido, string> = {
  ilegivel: 'Não foi possível ler este QR Code. Tente de novo ou escolha a prova na lista.',
  nao_reconhecido:
    'Este QR Code não corresponde a nenhuma prova deste aparelho. Confira a folha ou escolha a prova na lista.',
  outra_aplicacao:
    'Este QR Code é de outra aplicação. Confira a folha ou escolha a prova na lista.',
  ja_corrigida: 'Esta prova já foi corrigida e não pode ser reaberta.',
  sem_gabarito:
    'Esta versão não tem gabarito no aparelho. Sem ele, o aplicativo não permite corrigir a prova.',
};

export type ResultadoDoQr =
  | { ok: true; prova: { examVersionId: string; studentId?: string; nomeDoAluno: string } }
  | { ok: false; motivo: MotivoDoQrInvalido };

/** Compara o valor lido com as provas locais e diz se a aplicacao atual pode corrigi-la. */
export function validarQr(
  conteudo: unknown,
  applicationId: string,
  entradas: EntradaDoQr[],
): ResultadoDoQr {
  if (
    typeof conteudo !== 'string' ||
    conteudo.length === 0 ||
    conteudo.length > TAMANHO_MAXIMO_DO_QR
  ) {
    return { ok: false, motivo: 'ilegivel' };
  }

  const encontradas = entradas.filter((entrada) => entrada.qrCodePayload === conteudo);
  // O valor e unico no banco. Se vier repetido, nao ha como saber de quem e a prova.
  if (encontradas.length !== 1) return { ok: false, motivo: 'nao_reconhecido' };

  const [entrada] = encontradas;
  if (entrada.applicationId !== applicationId) return { ok: false, motivo: 'outra_aplicacao' };
  if (entrada.jaCorrigida) return { ok: false, motivo: 'ja_corrigida' };
  if (!entrada.temGabarito) return { ok: false, motivo: 'sem_gabarito' };

  return {
    ok: true,
    prova: {
      examVersionId: entrada.examVersionId,
      studentId: entrada.studentId,
      nomeDoAluno: entrada.nomeDoAluno,
    },
  };
}
