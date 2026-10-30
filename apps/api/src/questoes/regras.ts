import type { SalvarQuestaoDto } from './questoes.dto';

/**
 * Regras de RF02 que a API garante, mesmo que a tela ja as verifique: a tela pode
 * mudar, e outro cliente (o aplicativo, um script) pode chamar a API diretamente.
 * Devolve a lista de problemas encontrados; vazia quando a questao e valida.
 */
export function validarQuestao(questao: SalvarQuestaoDto): string[] {
  const problemas: string[] = [];

  if (!questao.statement.trim()) problemas.push('O enunciado e obrigatorio.');

  if (questao.type === 'objetiva') {
    const alternativas = questao.alternatives ?? [];
    if (alternativas.length < 2 || alternativas.length > 5) {
      problemas.push('A questao objetiva precisa de 2 a 5 alternativas.');
    }
    if (alternativas.some((alternativa) => !alternativa.text.trim())) {
      problemas.push('Toda alternativa precisa de texto.');
    }
    if (new Set(alternativas.map((alternativa) => alternativa.id)).size !== alternativas.length) {
      problemas.push('As alternativas precisam de ids distintos.');
    }
    if (!alternativas.some((alternativa) => alternativa.id === questao.correctAlternativeId)) {
      problemas.push('A alternativa correta precisa ser uma das alternativas.');
    }
    if (questao.maxScore !== undefined) {
      problemas.push('Pontuacao maxima so existe na questao discursiva.');
    }
  } else {
    if (questao.maxScore === undefined || questao.maxScore <= 0) {
      problemas.push('A questao discursiva precisa de pontuacao maxima maior que zero.');
    }
    if (questao.alternatives?.length || questao.correctAlternativeId) {
      problemas.push('Questao discursiva nao tem alternativas.');
    }
  }

  return problemas;
}
