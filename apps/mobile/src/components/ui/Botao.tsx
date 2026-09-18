import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { cores, espacamento, raio, tipografia } from '@sgp/design-tokens';

/**
 * Botao do aplicativo, equivalente ao `Button` da web.
 *
 * As variantes e as alturas seguem a regua de controles do design system web: padrao de
 * 44 px (o alvo de toque confortavel no celular, um pouco maior que os 40 px do mouse),
 * `sm` de 36 px, e a mesma hierarquia de intencao — padrao para a proxima acao,
 * `outline` para alternativa, `ghost` para baixa enfase, `destructive` para remocao.
 */
export type VarianteDoBotao = 'padrao' | 'outline' | 'ghost' | 'destructive';

interface Props {
  titulo: string;
  onPress?: () => void;
  variante?: VarianteDoBotao;
  tamanho?: 'padrao' | 'sm';
  desabilitado?: boolean;
  carregando?: boolean;
  /** Ocupa toda a largura disponivel. Usado na acao principal de uma tela. */
  largura?: 'auto' | 'total';
  icone?: ReactNode;
}

export function Botao({
  titulo,
  onPress,
  variante = 'padrao',
  tamanho = 'padrao',
  desabilitado = false,
  carregando = false,
  largura = 'auto',
  icone,
}: Props) {
  const inativo = desabilitado || carregando;
  const corDoTexto = corDoTextoPorVariante[variante];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inativo, busy: carregando }}
      accessibilityLabel={titulo}
      disabled={inativo}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.base,
        estilos[tamanho],
        estilosDaVariante[variante],
        largura === 'total' && estilos.total,
        // Sem hover no toque: o retorno visual e o pressionado.
        pressed && !inativo && estilos.pressionado,
        inativo && estilos.inativo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator size="small" color={corDoTexto} />
      ) : (
        <View style={estilos.conteudo}>
          {icone}
          <Text
            style={[estilos.titulo, tamanho === 'sm' && estilos.tituloSm, { color: corDoTexto }]}
          >
            {titulo}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const corDoTextoPorVariante: Record<VarianteDoBotao, string> = {
  padrao: cores.primaryForeground,
  outline: cores.foreground,
  ghost: cores.foreground,
  destructive: cores.destructiveForeground,
};

const estilos = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: raio.md,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: espacamento.lg,
  },
  padrao: { height: 44 },
  sm: { height: 36, paddingHorizontal: espacamento.md },
  total: { alignSelf: 'stretch' },
  conteudo: { flexDirection: 'row', alignItems: 'center', gap: espacamento.sm },
  titulo: { fontSize: tipografia.tamanho.md, fontWeight: '500' },
  tituloSm: { fontSize: tipografia.tamanho.sm },
  pressionado: { opacity: 0.85 },
  // Desabilitado mantem o rotulo legivel: ele ainda precisa ser lido para explicar o limite.
  inativo: { opacity: 0.5 },
});

const estilosDaVariante = StyleSheet.create({
  padrao: { backgroundColor: cores.primary },
  outline: { backgroundColor: cores.background, borderColor: cores.border },
  ghost: { backgroundColor: 'transparent' },
  destructive: { backgroundColor: cores.destructive },
});
