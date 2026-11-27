import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cores, espacamento, tipografia } from '@sgp/design-tokens';
import { Badge, Botao, Cartao, Tela } from '../components/ui';
import {
  calcularNotaObjetiva,
  formatarNota,
  obterProvaParaCorrigir,
  type RespostasObjetivas,
} from '../lib/estado-de-correcoes';
import {
  aplicarNaConferencia,
  marcarDivergencias,
  registrarBranco,
  registrarToque,
  type MarcacoesDaConferencia,
} from '../lib/leitura-do-cartao';
import type { PropsDaTela } from '../navegacao';

/**
 * Conferencia objetiva minima: o professor toca na letra marcada a caneta em cada
 * questao, e o aplicativo confronta com o gabarito local.
 *
 * Existe para que a correcao discursiva (#27) receba respostas reais — a alternativa
 * marcada (`selectedAlternativeId`) e o que vai para a fila. A tela completa da
 * conferencia, com leitura simulada e ajuste manual, e a issue #26. Sem camera na N1: o
 * toque na letra ocupa o lugar da leitura do cartao-resposta.
 */
export function ConferenciaObjetiva({ navigation, route }: PropsDaTela<'ConferenciaObjetiva'>) {
  const { examVersionId, studentId, nomeDoAluno, aplicacaoDaLeitura, divergenciasDaLeitura } =
    route.params;
  const prova = useMemo(() => obterProvaParaCorrigir(examVersionId), [examVersionId]);
  // Questao em branco segue sem resposta e vale zero.
  const [marcacoes, setMarcacoes] = useState<MarcacoesDaConferencia>({
    marcadas: {},
    emBranco: [],
    sugeridasPelaLeitura: [],
    divergentes: {},
  });
  const { marcadas, emBranco, sugeridasPelaLeitura, divergentes } = marcacoes;
  const ultimaLeituraAplicada = useRef<string>();
  const ultimaDivergenciaRegistrada = useRef<string>();

  useEffect(() => {
    if (!prova || !aplicacaoDaLeitura) return;
    if (ultimaLeituraAplicada.current === aplicacaoDaLeitura.id) return;
    ultimaLeituraAplicada.current = aplicacaoDaLeitura.id;

    setMarcacoes((atuais) =>
      aplicarNaConferencia(atuais, aplicacaoDaLeitura, prova.objetivas, examVersionId),
    );
  }, [aplicacaoDaLeitura, examVersionId, prova]);

  useEffect(() => {
    if (!divergenciasDaLeitura) return;
    if (ultimaDivergenciaRegistrada.current === divergenciasDaLeitura.id) return;
    ultimaDivergenciaRegistrada.current = divergenciasDaLeitura.id;

    setMarcacoes((atuais) => marcarDivergencias(atuais, divergenciasDaLeitura, examVersionId));
  }, [divergenciasDaLeitura, examVersionId]);

  // RF08: sem copia local do gabarito, nao se corrige. Explica em vez de esconder.
  if (!prova) {
    return (
      <Tela
        titulo={nomeDoAluno}
        acao={<Botao titulo="Correção indisponível" desabilitado largura="total" />}
      >
        <Cartao
          titulo="Sem cópia local do gabarito"
          descricao="Esta versão não tem gabarito no aparelho. Sem ele, o aplicativo não permite corrigir nem confirmar a correção."
        >
          {null}
        </Cartao>
      </Tela>
    );
  }

  const respostas: RespostasObjetivas = Object.entries(marcadas).map(
    ([questionId, selectedAlternativeId]) => ({ questionId, selectedAlternativeId }),
  );
  const notaObjetiva = calcularNotaObjetiva(prova, respostas);
  const faltam = prova.objetivas.length - respostas.length - emBranco.length;

  return (
    <Tela
      titulo={nomeDoAluno}
      descricao={`Versão ${prova.versionNumber}. Toque na alternativa marcada na folha de cada questão.`}
      acao={
        <>
          <Text style={estilos.resumo}>
            Nota objetiva: {formatarNota(notaObjetiva)} de {formatarNota(prova.maximoObjetivo)}
          </Text>
          {faltam > 0 ? (
            <Text style={estilos.pendencia}>
              Falta marcar {faltam} {faltam === 1 ? 'questão' : 'questões'}.
            </Text>
          ) : null}
          <Botao
            titulo="Ler cartão"
            variante="outline"
            largura="total"
            onPress={() =>
              navigation.navigate('LeituraCartao', {
                examVersionId,
                studentId,
                nomeDoAluno,
                marcadasAtuais: marcadas,
                emBrancoAtuais: emBranco,
                sugeridasAtuais: sugeridasPelaLeitura,
                divergentesAtuais: divergentes,
              })
            }
          />
          <Botao
            titulo="Continuar para discursivas"
            largura="total"
            desabilitado={faltam > 0}
            onPress={() =>
              navigation.navigate('NotasDiscursivas', {
                examVersionId,
                studentId,
                nomeDoAluno,
                respostas,
              })
            }
          />
        </>
      }
    >
      {prova.objetivas.map((questao) => {
        const marcada = marcadas[questao.questionId];
        const letraMarcada = questao.alternativas.find((item) => item.id === marcada)?.letra;
        const acertou = marcada === questao.correctAlternativeId;
        const sugestaoAnterior = divergentes[questao.questionId];
        const divergente = sugestaoAnterior !== undefined;
        const letraAnterior =
          sugestaoAnterior === null
            ? 'em branco'
            : questao.alternativas.find((item) => item.id === sugestaoAnterior)?.letra;

        return (
          <Cartao
            key={questao.questionId}
            titulo={`Questão ${questao.numero} · ${formatarNota(questao.pontuacao)} pt`}
            descricao={questao.enunciado}
          >
            <View style={estilos.letras}>
              {questao.alternativas.map((alternativa) => (
                <Botao
                  key={alternativa.id}
                  titulo={alternativa.letra}
                  rotuloAcessivel={`Questão ${questao.numero}, alternativa ${alternativa.letra}`}
                  variante={marcada === alternativa.id ? 'padrao' : 'outline'}
                  selecionado={marcada === alternativa.id}
                  onPress={() =>
                    setMarcacoes((atuais) =>
                      registrarToque(atuais, questao.questionId, alternativa.id),
                    )
                  }
                />
              ))}
              {/* Sem isso, um toque errado obrigaria a manter uma letra em questão sem resposta. */}
              {divergente || marcada !== undefined ? (
                <Botao
                  titulo="Em branco"
                  rotuloAcessivel={`Questão ${questao.numero}, deixar em branco`}
                  variante="outline"
                  onPress={() =>
                    setMarcacoes((atuais) => registrarBranco(atuais, questao.questionId))
                  }
                />
              ) : null}
            </View>

            {/* A selecao nao fica so na cor do botao: o resultado tambem e escrito. */}
            {divergente ? (
              <>
                <Badge texto="Revisar: leituras divergentes" variante="destructive" />
                <Text style={estilos.pendencia}>
                  A leitura anterior sugeriu {letraAnterior}. Confira na folha e decida.
                </Text>
              </>
            ) : letraMarcada ? (
              <Badge
                texto={
                  acertou ? `Marcou ${letraMarcada}: correta` : `Marcou ${letraMarcada}: errada`
                }
                variante={acertou ? 'padrao' : 'destructive'}
              />
            ) : emBranco.includes(questao.questionId) ? (
              <Badge texto="Em branco: vale zero" variante="outline" />
            ) : (
              <Badge texto="Sem marcação" variante="outline" />
            )}
          </Cartao>
        );
      })}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  letras: { flexDirection: 'row', flexWrap: 'wrap', gap: espacamento.sm },
  resumo: { fontSize: tipografia.tamanho.md, fontWeight: '600', color: cores.foreground },
  pendencia: { fontSize: tipografia.tamanho.sm, color: cores.mutedForeground },
});
