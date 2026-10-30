import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { cores, tipografia } from '@sgp/design-tokens';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RespostasObjetivas } from '../lib/estado-de-correcoes';
import { AplicacoesParaCorrigir } from '../telas/AplicacoesParaCorrigir';
import { Ambiente } from '../telas/Ambiente';
import { ConferenciaObjetiva } from '../telas/ConferenciaObjetiva';
import { NotasDiscursivas } from '../telas/NotasDiscursivas';
import { SelecionarProva } from '../telas/SelecionarProva';

/** A prova escolhida na selecao, que acompanha o professor ate a confirmacao. */
interface ProvaEscolhida {
  examVersionId: string;
  /** Ausente na prova sem identificacao: nada liga essa correcao a um aluno (RF09). */
  studentId?: string;
  nomeDoAluno: string;
}

/**
 * Navegacao do aplicativo do professor.
 *
 * Stack simples, e nao abas: o fluxo do professor e linear — lista da aplicacao, prova a
 * corrigir, conferencia, confirmacao — e cada passo depende do anterior. Abas fariam
 * sentido para secoes paralelas, que e o caso da web, nao daqui.
 *
 * O cabecalho usa os tokens compartilhados para a barra de navegacao nao introduzir uma
 * terceira linguagem visual entre a web e as telas do aplicativo.
 */
export type RotasDoAplicativo = {
  /** `correcaoSalva` chega da confirmacao, para a lista avisar que foi para a fila. */
  AplicacoesParaCorrigir: { correcaoSalva?: { id: string; resumo: string } } | undefined;
  SelecionarProva: { applicationId: string; tituloDaProva: string };
  ConferenciaObjetiva: ProvaEscolhida;
  NotasDiscursivas: ProvaEscolhida & { respostas: RespostasObjetivas };
  Ambiente: undefined;
};

export type PropsDaTela<Rota extends keyof RotasDoAplicativo> = NativeStackScreenProps<
  RotasDoAplicativo,
  Rota
>;

const Stack = createNativeStackNavigator<RotasDoAplicativo>();

export function Navegacao() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="AplicacoesParaCorrigir"
        screenOptions={{
          headerStyle: { backgroundColor: cores.background },
          headerTintColor: cores.foreground,
          headerTitleStyle: {
            fontSize: tipografia.tamanho.lg,
            fontWeight: '500',
          },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: cores.field },
        }}
      >
        <Stack.Screen
          name="AplicacoesParaCorrigir"
          component={AplicacoesParaCorrigir}
          options={{ title: 'SGP Católica' }}
        />
        <Stack.Screen
          name="SelecionarProva"
          component={SelecionarProva}
          options={{ title: 'Selecionar prova' }}
        />
        <Stack.Screen
          name="ConferenciaObjetiva"
          component={ConferenciaObjetiva}
          options={{ title: 'Conferência objetiva' }}
        />
        <Stack.Screen
          name="NotasDiscursivas"
          component={NotasDiscursivas}
          options={{ title: 'Notas discursivas' }}
        />
        <Stack.Screen name="Ambiente" component={Ambiente} options={{ title: 'SGP Católica' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
