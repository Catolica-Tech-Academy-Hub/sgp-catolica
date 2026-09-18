import { StyleSheet, Text } from 'react-native';
import { cores, tipografia } from '@sgp/design-tokens';

/**
 * Rotulo de campo ou de grupo, equivalente ao `Label` da web.
 *
 * `grupo` reproduz o rotulo de secao em caixa alta do painel da web — usado com
 * parcimonia, como diz o design system, porque caixa alta em excesso grita.
 */
interface Props {
  texto: string;
  variante?: 'campo' | 'grupo';
}

export function Rotulo({ texto, variante = 'campo' }: Props) {
  return <Text style={variante === 'grupo' ? estilos.grupo : estilos.campo}>{texto}</Text>;
}

const estilos = StyleSheet.create({
  campo: {
    fontSize: tipografia.tamanho.sm,
    fontWeight: '500',
    color: cores.foreground,
  },
  grupo: {
    fontSize: tipografia.tamanho.xs,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: cores.mutedForeground,
  },
});
