import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { cores, espacamento, tipografia } from '@sgp/design-tokens';
import { Badge, Botao, Cartao, Tela } from '../components/ui';
import type { VarianteDoBadge } from '../components/ui/Badge';
import { obterProvaParaCorrigir } from '../lib/estado-de-correcoes';
import type { QuestaoObjetivaParaConferir } from '../lib/estado-de-correcoes';
import {
  contarPendentes,
  executarLeitura,
  MENSAGENS_DE_BLOQUEIO,
  montarAplicacao,
  resolverQuestao,
} from '../lib/leitura-do-cartao';
import type {
  EstadoDaSugestao,
  MarcacoesDaConferencia,
  MotivoDoBloqueio,
  ResolucaoDaQuestao,
  RevisoesDaLeitura,
  SugestaoDaQuestao,
} from '../lib/leitura-do-cartao';
import type { PropsDaTela } from '../navegacao';
import { nucleoDeLeitura, obterFonteDeImagem } from '../viabilidade/nucleo-de-leitura';

type Fase =
  | { tipo: 'lendo' }
  | { tipo: 'concluida'; sugestoes: SugestaoDaQuestao[] }
  | { tipo: 'bloqueada'; motivo: MotivoDoBloqueio };

const ROTULO_DO_ESTADO: Record<EstadoDaSugestao, { texto: string; variante: VarianteDoBadge }> = {
  respondida: { texto: 'Leitura segura', variante: 'padrao' },
  em_branco: { texto: 'Em branco: vale zero', variante: 'outline' },
  multipla: { texto: 'Revisar: mais de uma marcação', variante: 'destructive' },
  revisar: { texto: 'Revisar: leitura incerta', variante: 'destructive' },
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
    const vistas = sugestao.alternativasDetectadasIds.map((id) => letraDe(questao, id));
    return vistas.length > 0
      ? `A leitura viu: ${vistas.join(', ')}. Escolha a resposta ou deixe em branco.`
      : 'Confira na folha e escolha a resposta ou deixe em branco.';
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
 * Mostra o que foi lido questao a questao e deixa o professor revisar. Nada sai desta tela
 * sem o aceite dele, e o aceite so preenche a conferencia: a correcao continua sendo
 * confirmada na tela de notas. Sem identificar a folha pelo QR Code (#97), o professor
 * precisa conferir se o cartao e mesmo o daquela prova.
 */
export function LeituraCartao({ navigation, route }: PropsDaTela<'LeituraCartao'>) {
  const { examVersionId, studentId, nomeDoAluno, marcadasAtuais, emBrancoAtuais } = route.params;
  const prova = useMemo(() => obterProvaParaCorrigir(examVersionId), [examVersionId]);
  const atuais: MarcacoesDaConferencia = { marcadas: marcadasAtuais, emBranco: emBrancoAtuais };

  const [fase, setFase] = useState<Fase>({ tipo: 'lendo' });
  const [revisoes, setRevisoes] = useState<RevisoesDaLeitura>({});
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!prova) return;
    let ativa = true;

    async function ler() {
      // Devolve o controle para o estado "lendo" aparecer antes do processamento pesado.
      await new Promise<void>((resolver) => setTimeout(resolver, 50));
      if (!ativa || !prova) return;
      const resultado = await executarLeitura(
        obterFonteDeImagem(),
        prova.objetivas,
        nucleoDeLeitura,
      );
      if (!ativa) return;
      setFase(
        resultado.ok
          ? { tipo: 'concluida', sugestoes: resultado.sugestoes }
          : { tipo: 'bloqueada', motivo: resultado.motivo },
      );
    }

    void ler();
    return () => {
      ativa = false;
    };
  }, [prova, tentativa]);

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
    setFase({ tipo: 'lendo' });
    setTentativa((atual) => atual + 1);
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
        </Cartao>
      </Tela>
    );
  }

  const { sugestoes } = fase;
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
      {prova.objetivas.map((questao, indice) => {
        const sugestao = sugestoes[indice];
        const resolucao = resolverQuestao(sugestao, atuais, revisoes);
        const rotulo = ROTULO_DO_ESTADO[sugestao.estado];

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
