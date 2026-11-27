import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { cores, espacamento, tipografia } from '@sgp/design-tokens';
import { Badge, Botao, Cartao, Tela } from '../components/ui';
import type { VarianteDoBadge } from '../components/ui/Badge';
import { prepararFoto, type OrientacaoExif } from '../lib/captura-do-cartao';
import { obterProvaParaCorrigir } from '../lib/estado-de-correcoes';
import type { QuestaoObjetivaParaConferir } from '../lib/estado-de-correcoes';
import {
  contarPendentes,
  executarLeitura,
  leituraConfirmaSugestaoAnterior,
  listarDivergencias,
  mensagemDeSugestaoRepetida,
  MENSAGENS_DE_BLOQUEIO,
  montarAplicacao,
  resolverQuestao,
  rotuloDaDecisaoManual,
  rotuloDaPendencia,
} from '../lib/leitura-do-cartao';
import type {
  AreaDetectada,
  EstadoDaSugestao,
  MarcacoesDaConferencia,
  MotivoDoBloqueio,
  ResolucaoDaQuestao,
  RevisoesDaLeitura,
  SugestaoDaQuestao,
} from '../lib/leitura-do-cartao';
import type { PropsDaTela } from '../navegacao';
import { nucleoDeLeitura } from '../viabilidade/nucleo-de-leitura';
import { AreaNaFoto, CapturaCartao } from './CapturaCartao';

type Fase =
  | { tipo: 'capturando' }
  | { tipo: 'lendo' }
  | {
      tipo: 'concluida';
      sugestoes: SugestaoDaQuestao[];
      foto: { base64: string; area: AreaDetectada; orientacao: OrientacaoExif };
    }
  | { tipo: 'bloqueada'; motivo: MotivoDoBloqueio };

const ROTULO_DO_ESTADO: Record<EstadoDaSugestao, { texto: string; variante: VarianteDoBadge }> = {
  respondida: { texto: 'Leitura segura', variante: 'padrao' },
  em_branco: { texto: 'Em branco: vale zero', variante: 'outline' },
  multipla: { texto: 'Revisar: mais de uma marcação', variante: 'destructive' },
  revisar: { texto: 'Revisar: leitura incerta', variante: 'destructive' },
};

const ROTULO_DE_MARCA_EXCEDENTE: { texto: string; variante: VarianteDoBadge } = {
  texto: 'Revisar: marca fora das alternativas',
  variante: 'destructive',
};

function letraDe(questao: QuestaoObjetivaParaConferir, id?: string | null) {
  return questao.alternativas.find((alternativa) => alternativa.id === id)?.letra;
}

function descreverValor(questao: QuestaoObjetivaParaConferir, valor?: string | null) {
  return valor === null ? 'em branco' : (letraDe(questao, valor) ?? 'sem resposta');
}

function descreverDecisao(
  questao: QuestaoObjetivaParaConferir,
  sugestao: SugestaoDaQuestao,
  resolucao: ResolucaoDaQuestao,
) {
  const valor = descreverValor(questao, resolucao.valor);
  if (resolucao.origem === 'pendente') {
    if (leituraConfirmaSugestaoAnterior(sugestao, resolucao)) {
      return mensagemDeSugestaoRepetida(descreverValor(questao, resolucao.valorAnterior));
    }
    const anterior =
      resolucao.valorAnterior !== undefined
        ? `A leitura anterior sugeriu ${descreverValor(questao, resolucao.valorAnterior)}. `
        : '';
    if (sugestao.marcaExcedente) {
      return `${anterior}Há uma marca em uma bolha que não existe nesta questão. Confira na folha e escolha a resposta ou deixe em branco.`;
    }
    const vistas = sugestao.alternativasDetectadasIds.map((id) => letraDe(questao, id));
    if (vistas.length > 0) {
      return `${anterior}A leitura viu: ${vistas.join(', ')}. Escolha a resposta ou deixe em branco.`;
    }
    return sugestao.estado === 'em_branco'
      ? `${anterior}Esta leitura não viu marcação. Escolha a resposta ou deixe em branco.`
      : `${anterior}Confira na folha e escolha a resposta ou deixe em branco.`;
  }
  if (resolucao.origem === 'revisao') return `Sua revisão: ${valor}.`;
  if (resolucao.origem === 'leitura') return `Sugestão da leitura: ${valor}.`;

  const sugerido = sugestao.estado === 'em_branco' ? null : sugestao.alternativaSugeridaId;
  const leituraDefinida = sugestao.estado === 'em_branco' || sugerido !== undefined;
  return leituraDefinida && sugerido !== resolucao.valor
    ? `Mantida a marcação atual: ${valor}. A leitura sugeriu ${descreverValor(questao, sugerido)}.`
    : `Mantida a marcação atual: ${valor}.`;
}

/**
 * Leitura do cartao-resposta (RF08, issue #98).
 *
 * Fotografa o cartao, le a foto no aparelho, mostra a area detectada e o resultado questao
 * a questao. Nada sai desta tela sem o aceite do professor, e o aceite so preenche a
 * conferencia: a correcao continua sendo confirmada na tela de notas. A foto nao confere o
 * QR Code da folha, entao o professor precisa conferir se o cartao e mesmo o daquela prova.
 */
export function LeituraCartao({ navigation, route }: PropsDaTela<'LeituraCartao'>) {
  const {
    examVersionId,
    studentId,
    nomeDoAluno,
    marcadasAtuais,
    emBrancoAtuais,
    sugeridasAtuais,
    divergentesAtuais,
  } = route.params;
  const prova = useMemo(() => obterProvaParaCorrigir(examVersionId), [examVersionId]);
  const atuais: MarcacoesDaConferencia = useMemo(
    () => ({
      marcadas: marcadasAtuais,
      emBranco: emBrancoAtuais,
      sugeridasPelaLeitura: sugeridasAtuais,
      divergentes: divergentesAtuais,
    }),
    [marcadasAtuais, emBrancoAtuais, sugeridasAtuais, divergentesAtuais],
  );

  const [fase, setFase] = useState<Fase>({ tipo: 'capturando' });
  const [revisoes, setRevisoes] = useState<RevisoesDaLeitura>({});
  const [fotoNaoApagada, setFotoNaoApagada] = useState(false);
  const montada = useRef(false);

  useEffect(() => {
    montada.current = true;
    return () => {
      montada.current = false;
    };
  }, []);

  async function lerFoto(base64: string) {
    if (!prova) return;
    setFase({ tipo: 'lendo' });
    // Devolve o controle para o estado "lendo" aparecer antes do processamento pesado.
    await new Promise<void>((resolver) => setTimeout(resolver, 50));
    if (!montada.current) return;

    let orientacao: OrientacaoExif = 1;
    const resultado = await executarLeitura(
      async () => {
        const foto = prepararFoto(base64);
        orientacao = foto.orientacao;
        return foto.imagem;
      },
      prova.objetivas,
      nucleoDeLeitura,
    );
    if (!montada.current) return;
    setFase(
      resultado.ok
        ? {
            tipo: 'concluida',
            sugestoes: resultado.sugestoes,
            foto: { base64, area: resultado.areaDetectada, orientacao },
          }
        : { tipo: 'bloqueada', motivo: resultado.motivo },
    );
  }

  // Registra a divergencia ao concluir, e nao ao sair: botao, seta e gesto ficam cobertos.
  useEffect(() => {
    if (fase.tipo !== 'concluida') return;
    const valoresAnteriores = listarDivergencias(fase.sugestoes, atuais);
    if (Object.keys(valoresAnteriores).length === 0) return;

    const conferencia = navigation
      .getState()
      .routes.find((rota) => rota.name === 'ConferenciaObjetiva');
    if (!conferencia) return;
    navigation.dispatch({
      ...CommonActions.setParams({
        divergenciasDaLeitura: { id: route.key, examVersionId, valoresAnteriores },
      }),
      source: conferencia.key,
    });
  }, [atuais, examVersionId, fase, navigation, route.key]);

  const voltarSemAplicar = (
    <Botao
      titulo="Voltar sem aplicar"
      variante="outline"
      largura="total"
      onPress={() => navigation.goBack()}
    />
  );

  if (!prova) {
    return (
      <Tela titulo={nomeDoAluno} acao={voltarSemAplicar}>
        <Cartao
          titulo="Sem cópia local do gabarito"
          descricao="Sem o gabarito no aparelho, o aplicativo não permite ler nem corrigir esta prova."
        >
          {null}
        </Cartao>
      </Tela>
    );
  }

  function tentarDeNovo() {
    setRevisoes({});
    setFase({ tipo: 'capturando' });
  }

  const avisoDaFoto = fotoNaoApagada ? (
    <Text accessibilityRole="alert" style={estilos.detalhe}>
      A foto temporária não pôde ser apagada e pode continuar no cache do aplicativo até o sistema
      limpá-lo.
    </Text>
  ) : null;

  if (fase.tipo === 'capturando') {
    return (
      <CapturaCartao
        titulo={nomeDoAluno}
        acaoVoltar={voltarSemAplicar}
        aoCapturar={(base64, descarte) => {
          if (descarte === 'falhou') setFotoNaoApagada(true);
          void lerFoto(base64);
        }}
      />
    );
  }

  if (fase.tipo === 'lendo') {
    return (
      <Tela titulo={nomeDoAluno} acao={voltarSemAplicar}>
        <Cartao titulo="Lendo o cartão" descricao="A leitura acontece no aparelho, sem internet.">
          <View accessibilityLiveRegion="polite" accessibilityLabel="Lendo o cartão">
            <ActivityIndicator color={cores.primary} />
          </View>
        </Cartao>
      </Tela>
    );
  }

  if (fase.tipo === 'bloqueada') {
    return (
      <Tela
        titulo={nomeDoAluno}
        acao={
          <>
            <Botao titulo="Tentar de novo" largura="total" onPress={tentarDeNovo} />
            {voltarSemAplicar}
          </>
        }
      >
        <Cartao titulo="Leitura bloqueada">
          <Text accessibilityRole="alert" style={estilos.erro}>
            {MENSAGENS_DE_BLOQUEIO[fase.motivo]}
          </Text>
          <Text style={estilos.detalhe}>Suas marcações na conferência não foram alteradas.</Text>
          {avisoDaFoto}
        </Cartao>
      </Tela>
    );
  }

  const { sugestoes, foto } = fase;
  const pendentes = contarPendentes(sugestoes, atuais, revisoes);

  function aplicar() {
    const id = `leitura-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const aplicacaoDaLeitura = montarAplicacao(id, examVersionId, sugestoes, atuais, revisoes);
    if (!aplicacaoDaLeitura) return;
    navigation.navigate('ConferenciaObjetiva', {
      examVersionId,
      studentId,
      nomeDoAluno,
      aplicacaoDaLeitura,
    });
  }

  return (
    <Tela
      titulo={nomeDoAluno}
      descricao={`Versão ${prova.versionNumber}. Confira se este é o cartão desta prova e revise o resultado.`}
      acao={
        <>
          <Text accessibilityLiveRegion="polite" style={estilos.resumo}>
            {pendentes > 0
              ? `Falta revisar ${pendentes} ${pendentes === 1 ? 'questão' : 'questões'}.`
              : 'Leitura concluída. Nada foi aplicado ainda.'}
          </Text>
          <Botao
            titulo="Aplicar e voltar à correção"
            largura="total"
            desabilitado={pendentes > 0}
            onPress={aplicar}
          />
          {voltarSemAplicar}
        </>
      }
    >
      <Cartao
        titulo="Área detectada"
        descricao="Confira se a marcação contorna o cartão. Se não, volte e fotografe de novo."
      >
        <AreaNaFoto base64={foto.base64} area={foto.area} orientacao={foto.orientacao} />
        {avisoDaFoto}
      </Cartao>

      {prova.objetivas.map((questao, indice) => {
        const sugestao = sugestoes[indice];
        const resolucao = resolverQuestao(sugestao, atuais, revisoes);
        const textoDaDecisao = rotuloDaDecisaoManual(
          sugestao,
          resolucao,
          descreverValor(questao, resolucao.valor),
        );
        const textoDaPendencia = rotuloDaPendencia(sugestao, resolucao);
        const rotulo: { texto: string; variante: VarianteDoBadge } = textoDaDecisao
          ? { texto: textoDaDecisao, variante: 'secondary' }
          : textoDaPendencia
            ? { texto: textoDaPendencia, variante: 'destructive' }
            : sugestao.marcaExcedente
              ? ROTULO_DE_MARCA_EXCEDENTE
              : ROTULO_DO_ESTADO[sugestao.estado];

        return (
          <Cartao key={questao.questionId} titulo={`Questão ${questao.numero}`}>
            <Badge texto={rotulo.texto} variante={rotulo.variante} />
            <Text style={estilos.detalhe}>{descreverDecisao(questao, sugestao, resolucao)}</Text>
            <View style={estilos.letras}>
              {questao.alternativas.map((alternativa) => (
                <Botao
                  key={alternativa.id}
                  titulo={alternativa.letra}
                  rotuloAcessivel={`Questão ${questao.numero}, alternativa ${alternativa.letra}`}
                  variante={resolucao.valor === alternativa.id ? 'padrao' : 'outline'}
                  selecionado={resolucao.valor === alternativa.id}
                  onPress={() =>
                    setRevisoes((atual) => ({ ...atual, [questao.questionId]: alternativa.id }))
                  }
                />
              ))}
              <Botao
                titulo="Em branco"
                rotuloAcessivel={`Questão ${questao.numero}, deixar em branco`}
                variante={resolucao.valor === null ? 'padrao' : 'outline'}
                selecionado={resolucao.valor === null}
                onPress={() => setRevisoes((atual) => ({ ...atual, [questao.questionId]: null }))}
              />
            </View>
          </Cartao>
        );
      })}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  letras: { flexDirection: 'row', flexWrap: 'wrap', gap: espacamento.sm },
  resumo: { fontSize: tipografia.tamanho.md, fontWeight: '600', color: cores.foreground },
  detalhe: { fontSize: tipografia.tamanho.sm, color: cores.mutedForeground },
  erro: { fontSize: tipografia.tamanho.md, color: cores.destructive },
});
