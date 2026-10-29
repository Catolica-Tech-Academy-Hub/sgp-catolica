import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NotaDiscursiva } from '@sgp/shared-types';
import { cores, tipografia } from '@sgp/design-tokens';
import { Botao, Campo, Cartao, Tela } from '../components/ui';
import {
  calcularNotaObjetiva,
  calcularNotaTotal,
  enfileirarCorrecao,
  formatarNota,
  lerNota,
  obterProvaParaCorrigir,
  validarNotaDiscursiva,
} from '../lib/estado-de-correcoes';
import type { PropsDaTela } from '../navegacao';

/**
 * Notas discursivas e confirmacao da correcao (RF08, issue #27).
 *
 * Depois da parte objetiva, o professor informa a nota de cada questao discursiva,
 * validada contra o `maxScore` do gabarito local, e a nota total e recalculada a cada
 * digitacao: nota objetiva + soma das discursivas.
 *
 * Prova sem identificacao: nome e matricula lidos na folha sao **so auxiliares**. Eles
 * vao para a fila como `reportedStudent*`, mas a correcao segue sem `studentId` — a
 * atribuicao da nota a um aluno e o RF09, feito pela web.
 */
export function NotasDiscursivas({ navigation, route }: PropsDaTela<'NotasDiscursivas'>) {
  const { examVersionId, studentId, nomeDoAluno, respostas } = route.params;
  const prova = obterProvaParaCorrigir(examVersionId);

  const [notas, setNotas] = useState<Record<string, string>>({});
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [tentouConfirmar, setTentouConfirmar] = useState(false);
  const [erroAoSalvar, setErroAoSalvar] = useState<string>();

  if (!prova) {
    return (
      <Tela
        titulo={nomeDoAluno}
        acao={<Botao titulo="Confirmar correção" desabilitado largura="total" />}
      >
        <Cartao
          titulo="Sem cópia local do gabarito"
          descricao="Sem o gabarito no aparelho, o aplicativo não permite confirmar a correção."
        >
          {null}
        </Cartao>
      </Tela>
    );
  }

  const erros = Object.fromEntries(
    prova.discursivas.map((questao) => [
      questao.questionId,
      validarNotaDiscursiva(notas[questao.questionId] ?? '', questao.maxScore),
    ]),
  );
  const todasValidas = prova.discursivas.every((questao) => !erros[questao.questionId]);

  // So entram no total as notas ja validas; as demais ainda nao valem nada.
  const notasValidas: NotaDiscursiva[] = prova.discursivas
    .filter((questao) => !erros[questao.questionId])
    .map((questao) => ({
      questionId: questao.questionId,
      score: lerNota(notas[questao.questionId]) ?? 0,
    }));

  const notaObjetiva = calcularNotaObjetiva(prova, respostas);
  const notaTotal = calcularNotaTotal(notaObjetiva, notasValidas);
  const notaMaxima = prova.maximoObjetivo + prova.maximoDiscursivo;

  function confirmar() {
    setTentouConfirmar(true);
    if (!prova || !todasValidas) return;

    const item = enfileirarCorrecao({
      examVersionId,
      // Com identificacao, o aluno veio da selecao. Sem identificacao, fica sem dono.
      studentId: prova.comIdentificacao ? studentId : undefined,
      reportedStudentName: prova.comIdentificacao ? undefined : nome.trim() || undefined,
      reportedStudentRegistration: prova.comIdentificacao
        ? undefined
        : matricula.trim() || undefined,
      objectiveAnswers: respostas,
      discursiveScores: notasValidas,
    });

    if (!item) {
      setErroAoSalvar('Sem cópia local do gabarito: a correção não pode ser confirmada.');
      return;
    }

    const quem = prova.comIdentificacao
      ? nomeDoAluno
      : `Prova sem identificação${nome.trim() ? ` (lido na folha: ${nome.trim()})` : ''}`;
    navigation.navigate('AplicacoesParaCorrigir', {
      correcaoSalva: {
        id: item.clientCorrectionId,
        resumo: `${quem} — nota ${formatarNota(notaTotal)} de ${formatarNota(notaMaxima)}.`,
      },
    });
  }

  return (
    <Tela
      titulo={nomeDoAluno}
      descricao={`Versão ${prova.versionNumber}. Informe a nota de cada questão discursiva.`}
      acao={
        <>
          <Text style={estilos.detalhe}>
            Objetiva {formatarNota(notaObjetiva)} + discursivas{' '}
            {formatarNota(calcularNotaTotal(0, notasValidas))}
          </Text>
          <Text accessibilityLiveRegion="polite" style={estilos.total}>
            Nota total: {formatarNota(notaTotal)} de {formatarNota(notaMaxima)}
            {todasValidas ? '' : ' (parcial)'}
          </Text>
          {tentouConfirmar && !todasValidas ? (
            <Text accessibilityRole="alert" style={estilos.erro}>
              Corrija as notas destacadas antes de confirmar.
            </Text>
          ) : null}
          {erroAoSalvar ? (
            <Text accessibilityRole="alert" style={estilos.erro}>
              {erroAoSalvar}
            </Text>
          ) : null}
          <Botao titulo="Confirmar correção" largura="total" onPress={confirmar} />
        </>
      }
    >
      {!prova.comIdentificacao ? (
        <Cartao
          titulo="Identificação lida na prova"
          descricao="Apenas auxiliar: preencher nome e matrícula não atribui a nota ao aluno. A nota fica calculada e sem dono até ser atribuída pela web."
        >
          <Campo
            rotulo="Nome"
            ajuda="Opcional"
            valor={nome}
            onChangeText={setNome}
            autoCapitalize="words"
            placeholder="Como está escrito na folha"
          />
          <Campo
            rotulo="Matrícula"
            ajuda="Opcional"
            valor={matricula}
            onChangeText={setMatricula}
            tipoDeTeclado="number-pad"
            placeholder="Como está escrita na folha"
          />
        </Cartao>
      ) : null}

      {prova.discursivas.length === 0 ? (
        <Cartao
          titulo="Sem questões discursivas"
          descricao="Esta versão só tem questões objetivas. A nota total é a nota objetiva."
        >
          {null}
        </Cartao>
      ) : (
        prova.discursivas.map((questao) => {
          const valor = notas[questao.questionId] ?? '';
          // Campo vazio so acusa erro depois de tentar confirmar, para nao gritar cedo.
          const mostrarErro = tentouConfirmar || valor.trim() !== '';

          return (
            <Cartao
              key={questao.questionId}
              titulo={`Questão ${questao.numero}`}
              descricao={questao.enunciado}
            >
              <Campo
                rotulo={`Nota da questão ${questao.numero}`}
                ajuda={`Máx. ${formatarNota(questao.maxScore)}`}
                valor={valor}
                onChangeText={(texto) => {
                  setErroAoSalvar(undefined);
                  setNotas((atual) => ({ ...atual, [questao.questionId]: texto }));
                }}
                tipoDeTeclado="decimal-pad"
                placeholder={`0 a ${formatarNota(questao.maxScore)}`}
                erro={mostrarErro ? erros[questao.questionId] : undefined}
              />
            </Cartao>
          );
        })
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  detalhe: { fontSize: tipografia.tamanho.sm, color: cores.mutedForeground },
  total: { fontSize: tipografia.tamanho.lg, fontWeight: '600', color: cores.foreground },
  erro: { fontSize: tipografia.tamanho.sm, color: cores.destructive },
});
