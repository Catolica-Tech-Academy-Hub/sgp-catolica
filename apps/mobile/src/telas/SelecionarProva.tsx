import { Badge, Botao, Cartao, Tela } from '../components/ui';
import { listarAtribuicoesDaAplicacao, useEstadoDeCorrecoes } from '../lib/estado-de-correcoes';
import type { PropsDaTela } from '../navegacao';

/**
 * Escolha da prova a corrigir, pelo QR Code (#97) ou pela lista.
 *
 * A lista continua como alternativa para QR danificado. O efeito das duas e o mesmo: chegar
 * a uma versao e, quando a prova tem identificacao, a um aluno. Versao minima para viabilizar
 * a #27 — a tela completa e a issue #25.
 */
export function SelecionarProva({ navigation, route }: PropsDaTela<'SelecionarProva'>) {
  useEstadoDeCorrecoes();
  const { applicationId, tituloDaProva } = route.params;
  const atribuicoes = listarAtribuicoesDaAplicacao(applicationId);

  return (
    <Tela
      titulo={tituloDaProva}
      descricao="Leia o QR Code impresso ou escolha a prova na lista."
      acao={
        <Botao
          titulo="Ler QR Code"
          largura="total"
          onPress={() => navigation.navigate('LeituraQrCode', { applicationId, tituloDaProva })}
        />
      }
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
