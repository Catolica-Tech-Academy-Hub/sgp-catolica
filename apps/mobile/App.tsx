import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Navegacao } from './src/navegacao';

/**
 * Raiz do aplicativo do professor.
 *
 * Só monta a casca: área segura, barra de status e o stack de navegação. Toda tela vive
 * em `src/telas`, e a composição de cada uma fica lá — este arquivo não deve crescer.
 *
 * Tema claro fixo, como na web ("claro é canônico na N1"): não há alternância exposta.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Navegacao />
    </SafeAreaProvider>
  );
}
