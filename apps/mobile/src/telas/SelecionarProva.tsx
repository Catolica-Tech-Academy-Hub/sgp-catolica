import { Badge, Cartao, Tela } from '../components/ui';
import { listarAtribuicoesDaAplicacao, useEstadoDeCorrecoes } from '../lib/estado-de-correcoes';
import type { PropsDaTela } from '../navegacao';

/**
 * Escolha da prova a corrigir, no lugar da leitura do QR Code.
 *
 * A N1 nao tem camera (`.claude/rules/00-escopo-n1.md`); o efeito da leitura e o mesmo:
 * chegar a uma versao e, quando a prova tem identificacao, a um aluno. Versao minima para
 * viabilizar a #27 — a tela completa e a issue #25.
 */
export function SelecionarProva({ navigation, route }: PropsDaTela<'SelecionarProva'>) {
  useEstadoDeCorrecoes();
  const { applicationId, tituloDaProva } = route.params;
  const atribuicoes = listarAtribuicoesDaAplicacao(applicationId);

  return (
    <Tela
      titulo={tituloDaProva}
      descricao="Nesta fase, escolher a prova na lista substitui a leitura do QR Code impresso."
    >
      {atribuicoes.map((atribuicao) => {
        const descricao = [
          `Versão ${atribuicao.versionNumber}`,
          atribuicao.matricula ? `Matrícula ${atribuicao.matricula}` : undefined,
        ]
          .filter(Boolean)
          .join(' · ');

        // Prova ja corrigida nao reabre: RF08 nunca sobrescreve uma correcao em silencio.
        if (atribuicao.jaCorrigida) {
          return (
            <Cartao key={atribuicao.id} titulo={atribuicao.nomeDoAluno} descricao={descricao}>
              <Badge texto="Já corrigida" variante="outline" />
            </Cartao>
          );
        }

        return (
          <Cartao
            key={atribuicao.id}
            titulo={atribuicao.nomeDoAluno}
            descricao={descricao}
            rotuloAcessivel={`Corrigir: ${atribuicao.nomeDoAluno}, ${descricao}`}
            onPress={() =>
              navigation.navigate('ConferenciaObjetiva', {
                examVersionId: atribuicao.examVersionId,
                studentId: atribuicao.studentId,
                nomeDoAluno: atribuicao.nomeDoAluno,
              })
            }
          >
            <Badge
              texto={atribuicao.comIdentificacao ? 'A corrigir' : 'Sem identificação'}
              variante={atribuicao.comIdentificacao ? 'padrao' : 'secondary'}
            />
          </Cartao>
        );
      })}
    </Tela>
  );
}
