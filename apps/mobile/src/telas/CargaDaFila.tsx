import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cores, tipografia } from '@sgp/design-tokens';
import { Botao, Cartao, Tela } from '../components/ui';
import { iniciarFilaPersistente } from '../lib/estado-de-correcoes';

type Fase = 'carregando' | 'pronta' | 'erro';

/**
 * Carrega a fila salva no aparelho antes de abrir o aplicativo (RF08, issue #99).
 *
 * Sem essa carga, uma prova ja corrigida pareceria pendente e poderia ser corrigida de novo.
 * Por isso uma falha de leitura bloqueia a entrada e oferece nova tentativa.
 */
export function CargaDaFila({ children }: { children: ReactNode }) {
  const [fase, setFase] = useState<Fase>('carregando');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativa = true;
    iniciarFilaPersistente(AsyncStorage)
      .then(() => {
        if (ativa) setFase('pronta');
      })
      .catch(() => {
        if (ativa) setFase('erro');
      });
    return () => {
      ativa = false;
    };
  }, [tentativa]);

  if (fase === 'pronta') return <>{children}</>;

  return (
    <SafeAreaView style={estilos.raiz}>
      {fase === 'carregando' ? (
        <Tela titulo="SGP Católica" descricao="Carregando as correções salvas no aparelho.">
          <ActivityIndicator accessibilityLabel="Carregando as correções" color={cores.primary} />
        </Tela>
      ) : (
        <Tela
          titulo="SGP Católica"
          acao={
            <Botao
              titulo="Tentar de novo"
              largura="total"
              onPress={() => {
                setFase('carregando');
                setTentativa((atual) => atual + 1);
              }}
            />
          }
        >
          <Cartao titulo="Não foi possível carregar as correções">
            <Text accessibilityRole="alert" style={estilos.erro}>
              As correções salvas não foram apagadas. Tente de novo antes de continuar.
            </Text>
          </Cartao>
        </Tela>
      )}
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: cores.field },
  erro: { fontSize: tipografia.tamanho.md, color: cores.destructive },
});
