import { StyleSheet, Text, View } from 'react-native';
import { cores, espacamento, tipografia } from '@sgp/design-tokens';
import { Badge, Botao, Cartao, Tela } from '../components/ui';
import { listarAplicacoesGeradas, useEstadoDeCorrecoes } from '../lib/estado-de-correcoes';
import type { PropsDaTela } from '../navegacao';

/**
 * Lista das aplicacoes com prova gerada — a entrada do fluxo de correcao (RF08).
 *
 * Versao minima, so o necessario para chegar a correcao discursiva (#27). A tela
 * completa, com estados de carregamento e vazio detalhados, e a issue #24.
 *
 * Tambem e onde o professor volta depois de confirmar uma correcao: o aviso diz que ela
 * ficou na fila local como pendente, sem fingir que foi enviada.
 */
export function AplicacoesParaCorrigir({
  navigation,
  route,
}: PropsDaTela<'AplicacoesParaCorrigir'>) {
  useEstadoDeCorrecoes();
  const aplicacoes = listarAplicacoesGeradas();
  const correcaoSalva = route.params?.correcaoSalva;

  return (
    <Tela titulo="Correções" descricao="Escolha a aplicação cuja prova você vai corrigir.">
      {correcaoSalva ? (
        <Cartao titulo="Correção salva na fila local">
          <View accessibilityRole="alert" style={estilos.aviso}>
            <Badge texto="Pendente" variante="secondary" />
            <Text style={estilos.texto}>{correcaoSalva.resumo}</Text>
            <Text style={estilos.nota}>
              Nada foi enviado ao servidor nesta fase, e a fila só existe enquanto o aplicativo
              estiver aberto.
            </Text>
          </View>
          <Botao
            titulo="Dispensar aviso"
            variante="ghost"
            tamanho="sm"
            onPress={() => navigation.setParams({ correcaoSalva: undefined })}
          />
        </Cartao>
      ) : null}

      {aplicacoes.length === 0 ? (
        <Cartao
          titulo="Nenhuma aplicação para corrigir"
          descricao="Só aparecem aqui aplicações cuja prova já foi gerada em PDF."
        >
          {null}
        </Cartao>
      ) : (
        aplicacoes.map((aplicacao) => (
          <Cartao
            key={aplicacao.id}
            titulo={aplicacao.tituloDaProva}
            descricao={[aplicacao.nomeDaTurma, aplicacao.disciplina].filter(Boolean).join(' · ')}
            rotuloAcessivel={`${aplicacao.tituloDaProva}, ${aplicacao.nomeDaTurma}`}
            onPress={() =>
              navigation.navigate('SelecionarProva', {
                applicationId: aplicacao.id,
                tituloDaProva: aplicacao.tituloDaProva,
              })
            }
          >
            {/* Prova anonima nao tem total impresso conhecido: nao prometer um numero. */}
            {aplicacao.totalDeProvas > 0 ? (
              <Badge
                texto={`${aplicacao.pendentes} a corrigir`}
                variante={aplicacao.pendentes > 0 ? 'padrao' : 'outline'}
              />
            ) : (
              <Badge texto="Sem contagem de provas" variante="outline" />
            )}
          </Cartao>
        ))
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  aviso: { gap: espacamento.xs },
  texto: { fontSize: tipografia.tamanho.md, color: cores.foreground },
  nota: { fontSize: tipografia.tamanho.sm, color: cores.mutedForeground },
});
