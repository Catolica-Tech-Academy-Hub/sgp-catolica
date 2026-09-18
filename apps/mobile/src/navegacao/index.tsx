import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { cores, tipografia } from '@sgp/design-tokens';
import { Ambiente } from '../telas/Ambiente';

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
  Ambiente: undefined;
};

const Stack = createNativeStackNavigator<RotasDoAplicativo>();

export function Navegacao() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Ambiente"
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
        <Stack.Screen name="Ambiente" component={Ambiente} options={{ title: 'SGP Católica' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
