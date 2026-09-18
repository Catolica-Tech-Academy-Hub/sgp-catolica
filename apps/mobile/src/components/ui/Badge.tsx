import { StyleSheet, Text, View } from 'react-native';
import { cores, espacamento, raio, tipografia } from '@sgp/design-tokens';

/**
 * Marca de estado, equivalente ao `Badge` da web: pilula de 24 px com texto de 12 px.
 *
 * As variantes sao as mesmas, e valem para o mesmo tipo de informacao: `padrao` para o
 * estado positivo/ativo, `secondary` para o intermediario, `outline` para o encerrado ou
 * apenas informativo, `destructive` para erro.
 */
export type VarianteDoBadge = 'padrao' | 'secondary' | 'outline' | 'destructive';

interface Props {
  texto: string;
  variante?: VarianteDoBadge;
}

export function Badge({ texto, variante = 'padrao' }: Props) {
  return (
    <View style={[estilos.base, estilosDaVariante[variante]]}>
      <Text style={[estilos.texto, { color: corDoTextoPorVariante[variante] }]}>{texto}</Text>
    </View>
  );
}

const corDoTextoPorVariante: Record<VarianteDoBadge, string> = {
  padrao: cores.primaryForeground,
  secondary: cores.secondaryForeground,
  outline: cores.mutedForeground,
  destructive: cores.destructiveForeground,
};

const estilos = StyleSheet.create({
  base: {
    height: 24,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderRadius: raio.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: espacamento.sm,
  },
  texto: { fontSize: tipografia.tamanho.xs, fontWeight: '500' },
});

const estilosDaVariante = StyleSheet.create({
  padrao: { backgroundColor: cores.primary },
  secondary: { backgroundColor: cores.secondary },
  outline: { backgroundColor: 'transparent', borderColor: cores.border },
  destructive: { backgroundColor: cores.destructive },
});
