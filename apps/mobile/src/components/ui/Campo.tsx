import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import { cores, espacamento, raio, tipografia } from '@sgp/design-tokens';
import { Rotulo } from './Rotulo';

/**
 * Campo de texto, equivalente ao `Input` da web.
 *
 * O erro fica junto do campo e e anunciado por `accessibilityLabel`, que e o
 * equivalente pratico do `aria-invalid` + mensagem adjacente usado na web: o
 * React Native nao tem `aria-describedby`, entao o texto do erro entra no nome
 * acessivel do proprio campo, para o leitor de tela nao anunciar so "campo invalido"
 * sem dizer o motivo.
 */
interface Props {
  rotulo: string;
  valor: string;
  onChangeText: (valor: string) => void;
  placeholder?: string;
  erro?: string;
  /** Texto de apoio permanente, como "Minimo de 8 caracteres". */
  ajuda?: string;
  segredo?: boolean;
  tipoDeTeclado?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multilinha?: boolean;
  desabilitado?: boolean;
}

export function Campo({
  rotulo,
  valor,
  onChangeText,
  placeholder,
  erro,
  ajuda,
  segredo = false,
  tipoDeTeclado,
  autoCapitalize = 'none',
  multilinha = false,
  desabilitado = false,
}: Props) {
  const [focado, setFocado] = useState(false);

  return (
    <View style={estilos.grupo}>
      <View style={estilos.linhaDoRotulo}>
        <Rotulo texto={rotulo} />
        {ajuda ? <Text style={estilos.ajuda}>{ajuda}</Text> : null}
      </View>

      <TextInput
        accessibilityLabel={erro ? `${rotulo}. ${erro}` : rotulo}
        accessibilityState={{ disabled: desabilitado }}
        value={valor}
        onChangeText={onChangeText}
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
        placeholder={placeholder}
        placeholderTextColor={cores.mutedForeground}
        secureTextEntry={segredo}
        keyboardType={tipoDeTeclado}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multilinha}
        editable={!desabilitado}
        style={[
          estilos.campo,
          multilinha && estilos.multilinha,
          focado && estilos.focado,
          Boolean(erro) && estilos.comErro,
          desabilitado && estilos.desabilitado,
        ]}
      />

      {erro ? (
        <Text accessibilityRole="alert" style={estilos.erro}>
          {erro}
        </Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espacamento.xs },
  linhaDoRotulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ajuda: { fontSize: tipografia.tamanho.xs, color: cores.mutedForeground },
  campo: {
    height: 44,
    borderWidth: 1,
    borderColor: cores.input,
    borderRadius: raio.md,
    paddingHorizontal: espacamento.md,
    fontSize: tipografia.tamanho.md,
    color: cores.foreground,
    backgroundColor: cores.background,
  },
  multilinha: { height: 96, paddingTop: espacamento.md, textAlignVertical: 'top' },
  // O foco muda a borda **e** ganha anel: cor sozinha nao serve a quem nao a distingue.
  focado: { borderColor: cores.ring, borderWidth: 2 },
  comErro: { borderColor: cores.destructive },
  desabilitado: { backgroundColor: cores.muted, color: cores.mutedForeground },
  erro: { fontSize: tipografia.tamanho.xs, color: cores.destructive },
});
