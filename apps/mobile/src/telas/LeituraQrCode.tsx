import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { cores, raio, tipografia } from '@sgp/design-tokens';
import { Botao, Cartao, Tela } from '../components/ui';
import { listarEntradasDoQr } from '../lib/estado-de-correcoes';
import { MENSAGENS_DO_QR, validarQr, type MotivoDoQrInvalido } from '../lib/leitura-do-qr';
import type { PropsDaTela } from '../navegacao';

/**
 * Leitura do QR Code impresso na prova (RF08, issue #97).
 *
 * Identifica a versao e, quando houver, o aluno, e abre a conferencia. A leitura nao confirma
 * nada, e a escolha na lista continua disponivel para QR danificado ou camera sem permissao.
 */
export function LeituraQrCode({ navigation, route }: PropsDaTela<'LeituraQrCode'>) {
  const { applicationId, tituloDaProva } = route.params;
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [erro, setErro] = useState<MotivoDoQrInvalido>();
  // A camera repete o evento enquanto o QR esta no quadro; so a primeira leitura conta.
  const processando = useRef(false);

  const escolherNaLista = (
    <Botao
      titulo="Escolher na lista"
      variante="outline"
      largura="total"
      onPress={() => navigation.goBack()}
    />
  );

  function aoLerQr({ data }: { data: string }) {
    if (processando.current) return;
    processando.current = true;

    const resultado = validarQr(data, applicationId, listarEntradasDoQr());
    if (resultado.ok) {
      // Substitui esta tela: voltar da conferencia leva a lista, e nao de novo a camera.
      navigation.replace('ConferenciaObjetiva', resultado.prova);
      return;
    }
    setErro(resultado.motivo);
  }

  function lerNovamente() {
    processando.current = false;
    setErro(undefined);
  }

  if (!permissao) {
    return (
      <Tela
        titulo={tituloDaProva}
        descricao="Verificando a permissão da câmera."
        acao={escolherNaLista}
      >
        {null}
      </Tela>
    );
  }

  if (!permissao.granted) {
    return (
      <Tela
        titulo={tituloDaProva}
        acao={
          <>
            {permissao.canAskAgain ? (
              <Botao
                titulo="Permitir câmera"
                largura="total"
                onPress={() => void pedirPermissao()}
              />
            ) : null}
            {escolherNaLista}
          </>
        }
      >
        <Cartao titulo="Câmera sem permissão">
          <Text accessibilityRole="alert" style={estilos.mensagem}>
            {permissao.canAskAgain
              ? 'Permita o acesso à câmera para ler o QR Code da prova, ou escolha a prova na lista.'
              : 'O acesso à câmera foi negado. Libere nos ajustes do aparelho ou escolha a prova na lista.'}
          </Text>
        </Cartao>
      </Tela>
    );
  }

  return (
    <Tela
      titulo={tituloDaProva}
      descricao="Aponte a câmera para o QR Code impresso na prova."
      acao={
        <>
          {erro ? <Botao titulo="Ler novamente" largura="total" onPress={lerNovamente} /> : null}
          {escolherNaLista}
        </>
      }
    >
      <View style={estilos.moldura}>
        <CameraView
          style={estilos.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={erro ? undefined : aoLerQr}
        />
      </View>

      {erro ? (
        <Cartao titulo="QR Code não aceito">
          <Text accessibilityRole="alert" style={estilos.erro}>
            {MENSAGENS_DO_QR[erro]}
          </Text>
        </Cartao>
      ) : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  moldura: {
    aspectRatio: 1,
    borderRadius: raio.lg,
    overflow: 'hidden',
    backgroundColor: cores.foreground,
  },
  camera: { flex: 1 },
  mensagem: { fontSize: tipografia.tamanho.md, color: cores.foreground },
  erro: { fontSize: tipografia.tamanho.md, color: cores.destructive },
});
