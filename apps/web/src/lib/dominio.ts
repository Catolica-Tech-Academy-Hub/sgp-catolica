/**
 * Vocabulario do dominio para a interface.
 *
 * Os tipos vem de `@sgp/shared-types` em ingles; a interface fala portugues.
 * Este arquivo concentra essa traducao para nenhuma tela inventar rotulo proprio.
 */
import type { StatusAplicacao, StatusProva, StatusTurma } from '@sgp/shared-types';

export type Tom = 'neutro' | 'positivo' | 'atencao' | 'encerrado';

export const statusDaProva: Record<StatusProva, { rotulo: string; tom: Tom; ajuda: string }> = {
  draft: {
    rotulo: 'Rascunho',
    tom: 'atencao',
    ajuda: 'Ainda em montagem. Nao pode ser aplicada.',
  },
  ready: {
    rotulo: 'Pronta',
    tom: 'positivo',
    ajuda: 'Fechada para edicao e liberada para aplicar em turmas.',
  },
  closed: {
    rotulo: 'Encerrada',
    tom: 'encerrado',
    ajuda: 'Nao aceita novas aplicacoes. As aplicacoes existentes seguem valendo.',
  },
};

export const statusDaAplicacao: Record<StatusAplicacao, { rotulo: string; tom: Tom }> = {
  draft: { rotulo: 'Rascunho', tom: 'atencao' },
  generated: { rotulo: 'Gerada', tom: 'positivo' },
  closed: { rotulo: 'Encerrada', tom: 'encerrado' },
};

export function varianteDoStatusDaAplicacao(
  status: StatusAplicacao,
): 'default' | 'secondary' | 'outline' {
  if (status === 'generated') return 'default';
  if (status === 'draft') return 'secondary';
  return 'outline';
}

export function varianteDoStatusDaProva(status: StatusProva): 'default' | 'secondary' | 'outline' {
  if (status === 'ready') return 'default';
  if (status === 'draft') return 'secondary';
  return 'outline';
}

export const statusDaTurma: Record<StatusTurma, { rotulo: string; tom: Tom; ajuda: string }> = {
  active: {
    rotulo: 'Ativa',
    tom: 'positivo',
    ajuda: 'Aceita matrículas e pode receber novas aplicações.',
  },
  archived: {
    rotulo: 'Arquivada',
    tom: 'encerrado',
    ajuda: 'Não aparece para novas matrículas. As aplicações existentes seguem valendo.',
  },
};

export function varianteDoStatusDaTurma(status: StatusTurma): 'default' | 'outline' {
  return status === 'active' ? 'default' : 'outline';
}

const formatadorDeData = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function formatarData(iso: string): string {
  return formatadorDeData.format(new Date(iso));
}

const formatadorDePontos = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatarPontos(total: number): string {
  return formatadorDePontos.format(total);
}

/** Compara ignorando caixa e acentuacao, para a busca nao depender da digitacao. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');
}
