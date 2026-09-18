import { StyleSheet, Text, View } from 'react-native';
import { cores, espacamento, tipografia } from '@sgp/design-tokens';
import { Badge, Botao, Cartao, Tela } from '../components/ui';
import { listarAplicacoesGeradas } from '../lib/estado-de-correcoes';

/**
 * Tela de validacao do ambiente.
 *
 * Substitui o `App.tsx` de scaffold e serve de prova executavel de que a arquitetura
 * funciona: navegacao montada, tokens sincronizados com a web, primitivos consumindo
 * esses tokens e o modulo de estado lendo os mocks compartilhados.
 *
 * Sai do lugar assim que as telas do fluxo de correcao existirem (RF08).
 */
export function Ambiente() {
  const aplicacoes = listarAplicacoesGeradas();

  return (
    <Tela
      titulo="Aplicativo do professor"
      descricao="Arquitetura pronta. As telas de correção entram nas próximas entregas."
      acao={<Botao titulo="Ainda não há fluxo para abrir" desabilitado largura="total" />}
    >
      <Cartao
        titulo="Pacotes compartilhados"
        descricao="Tokens, tipos e dados estáticos vêm dos mesmos pacotes da web."
      >
        <View style={estilos.linhaDeBadges}>
          <Badge texto="@sgp/design-tokens" variante="secondary" />
          <Badge texto="@sgp/shared-types" variante="secondary" />
          <Badge texto="@sgp/mocks" variante="secondary" />
        </View>
      </Cartao>

      <Cartao
        titulo="Aplicações com prova gerada"
        descricao="O que a lista de correção vai consumir, já vindo do módulo de estado."
      >
        {aplicacoes.map((aplicacao) => (
          <View key={aplicacao.id} style={estilos.item}>
            <View style={estilos.itemTexto}>
              <Text style={estilos.itemTitulo}>{aplicacao.tituloDaProva}</Text>
              <Text style={estilos.itemDescricao}>{aplicacao.nomeDaTurma}</Text>
            </View>
            <Badge
              texto={`${aplicacao.pendentes} a corrigir`}
              variante={aplicacao.pendentes > 0 ? 'padrao' : 'outline'}
            />
          </View>
        ))}
      </Cartao>

      <Cartao titulo="Paleta">
        <View style={estilos.paleta}>
          {[cores.primary, cores.field, cores.card, cores.secondary, cores.destructive].map(
            (cor) => (
              <View key={cor} style={[estilos.amostra, { backgroundColor: cor }]} />
            ),
          )}
        </View>
        <Text style={estilos.nota}>
          Convertida do tema da web (OKLCH) para hex, porque StyleSheet não aceita oklch().
        </Text>
      </Cartao>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  linhaDeBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: espacamento.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.md,
    paddingTop: espacamento.sm,
  },
  itemTexto: { flex: 1, gap: 2 },
  itemTitulo: { fontSize: tipografia.tamanho.md, color: cores.foreground },
  itemDescricao: { fontSize: tipografia.tamanho.sm, color: cores.mutedForeground },
  paleta: { flexDirection: 'row', gap: espacamento.sm },
  amostra: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: cores.border,
  },
  nota: { fontSize: tipografia.tamanho.xs, color: cores.mutedForeground },
});
