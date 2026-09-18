import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { cores, espacamento, tipografia } from '@sgp/design-tokens';

/**
 * Moldura de uma tela do aplicativo — o equivalente da casca da web.
 *
 * Toda tela do fluxo de correcao usa esta moldura: campo de trabalho cinza, titulo e
 * descricao no topo, conteudo rolavel e, quando existir, uma barra de acao fixa na base.
 *
 * A acao principal fica **fixa embaixo**, e nao no fim da rolagem, porque no celular a
 * proxima acao precisa estar sob o polegar, nao a uma rolagem de distancia. Esse e o
 * ponto em que o mobile se afasta de proposito da web, onde a acao vive no cabecalho da
 * secao.
 */
interface Props {
  children: ReactNode;
  titulo?: string;
  descricao?: string;
  /** Barra fixa na base, para a acao principal da tela. */
  acao?: ReactNode;
  /** Desliga a rolagem quando a propria tela ja controla uma lista rolavel. */
  rolavel?: boolean;
}

export function Tela({ children, titulo, descricao, acao, rolavel = true }: Props) {
  const cabecalho =
    titulo || descricao ? (
      <View style={estilos.cabecalho}>
        {titulo ? (
          <Text accessibilityRole="header" style={estilos.titulo}>
            {titulo}
          </Text>
        ) : null}
        {descricao ? <Text style={estilos.descricao}>{descricao}</Text> : null}
      </View>
    ) : null;

  return (
    <View style={estilos.tela}>
      {rolavel ? (
        <ScrollView
          contentContainerStyle={estilos.conteudo}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {cabecalho}
          {children}
        </ScrollView>
      ) : (
        <View style={[estilos.conteudo, estilos.semRolagem]}>
          {cabecalho}
          {children}
        </View>
      )}

      {acao ? <View style={estilos.barraDeAcao}>{acao}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.field },
  conteudo: { padding: espacamento.lg, gap: espacamento.md },
  semRolagem: { flex: 1 },
  cabecalho: { gap: espacamento.xs },
  titulo: { fontSize: tipografia.tamanho.xl, fontWeight: '500', color: cores.foreground },
  descricao: { fontSize: tipografia.tamanho.md, color: cores.mutedForeground },
  barraDeAcao: {
    borderTopWidth: 1,
    borderTopColor: cores.border,
    backgroundColor: cores.background,
    padding: espacamento.lg,
    gap: espacamento.sm,
  },
});
