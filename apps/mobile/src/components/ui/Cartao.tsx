import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { cores, espacamento, raio, tipografia } from '@sgp/design-tokens';

/**
 * Objeto elevado sobre o campo de trabalho, equivalente ao `Card` da web.
 *
 * Com `onPress`, o cartao inteiro e o alvo de toque — a regra da web ("se a linha e o
 * objeto que abre, o cartao inteiro e um alvo") vale ainda mais no celular, onde um
 * alvo pequeno e um erro de toque.
 */
interface Props {
  children: ReactNode;
  titulo?: string;
  descricao?: string;
  onPress?: () => void;
  /** Nome acessivel do cartao tocavel, quando o titulo nao basta. */
  rotuloAcessivel?: string;
}

export function Cartao({ children, titulo, descricao, onPress, rotuloAcessivel }: Props) {
  const conteudo = (
    <>
      {titulo ? <Text style={estilos.titulo}>{titulo}</Text> : null}
      {descricao ? <Text style={estilos.descricao}>{descricao}</Text> : null}
      {children}
    </>
  );

  if (!onPress) {
    return <View style={estilos.cartao}>{conteudo}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel ?? titulo}
      onPress={onPress}
      style={({ pressed }) => [estilos.cartao, pressed && estilos.pressionado]}
    >
      {conteudo}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    backgroundColor: cores.card,
    borderColor: cores.border,
    borderWidth: 1,
    borderRadius: raio.lg,
    padding: espacamento.lg,
    gap: espacamento.sm,
  },
  pressionado: { backgroundColor: cores.accent },
  titulo: {
    fontSize: tipografia.tamanho.md,
    fontWeight: '500',
    color: cores.cardForeground,
  },
  descricao: { fontSize: tipografia.tamanho.sm, color: cores.mutedForeground },
});
