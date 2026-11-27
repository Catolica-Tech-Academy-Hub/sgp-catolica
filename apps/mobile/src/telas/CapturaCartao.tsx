import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { deleteAsync } from 'expo-file-system';
import { cores, raio, tipografia } from '@sgp/design-tokens';
import { Botao, Cartao, Tela } from '../components/ui';
import {
  areaNaFotoExibida,
  descartarFoto,
  segmentosDaArea,
  type OrientacaoExif,
  type ResultadoDoDescarte,
} from '../lib/captura-do-cartao';
import type { AreaDetectada } from '../lib/leitura-do-cartao';
import { escolherTamanhoDaFoto } from '../viabilidade/obter-pixels';

/** Se a camera nao avisar de novo depois de trocar a resolucao, libera a captura. */
const ESPERA_DA_CAMERA_MS = 3000;
const QUALIDADE_DA_FOTO = 0.9;
const ESPESSURA_DA_LINHA = 4;
const TAMANHO_DO_CANTO = 12;

interface PropsDaCaptura {
  titulo: string;
  acaoVoltar: ReactNode;
  aoCapturar: (base64: string, descarte: ResultadoDoDescarte) => void;
}

const apagarArquivo = (uri: string) => deleteAsync(uri, { idempotent: true });

/**
 * Captura da foto do cartao-resposta (RF08, issue #98).
 *
 * Tira uma foto por toque, apaga o arquivo temporario da camera e entrega o JPEG em memoria
 * para a leitura local. Sem permissao, a tela explica e o professor volta para a conferencia
 * por toque.
 */
export function CapturaCartao({ titulo, acaoVoltar, aoCapturar }: PropsDaCaptura) {
  const [permissao, pedirPermissao] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const tamanhoJaEscolhido = useRef(false);
  const capturando = useRef(false);
  const [tamanho, setTamanho] = useState<string>();
  const [pronta, setPronta] = useState(false);
  const [tirandoFoto, setTirandoFoto] = useState(false);
  const [erro, setErro] = useState<string>();

  useEffect(() => {
    if (!tamanho || pronta) return;
    const espera = setTimeout(() => setPronta(true), ESPERA_DA_CAMERA_MS);
    return () => clearTimeout(espera);
  }, [tamanho, pronta]);

  async function aoFicarPronta() {
    if (tamanhoJaEscolhido.current) {
      setPronta(true);
      return;
    }
    tamanhoJaEscolhido.current = true;

    try {
      const disponiveis = await camera.current?.getAvailablePictureSizesAsync();
      const escolhido = escolherTamanhoDaFoto(disponiveis ?? []);
      if (escolhido) {
        // Trocar a resolucao recria a camera, que avisa de novo quando estiver pronta.
        setTamanho(escolhido);
        return;
      }
    } catch {
      // Sem a lista de tamanhos, segue na resolucao padrao do aparelho.
    }
    setPronta(true);
  }

  async function tirarFoto() {
    if (!camera.current || capturando.current) return;
    capturando.current = true;
    setTirandoFoto(true);
    setErro(undefined);

    try {
      const foto = await camera.current.takePictureAsync({
        base64: true,
        quality: QUALIDADE_DA_FOTO,
      });
      // Apaga antes de validar: mesmo uma foto sem dados nao pode ficar no aparelho.
      const descarte = await descartarFoto(foto?.uri, apagarArquivo);
      if (!foto?.base64) throw new Error('foto sem dados');
      aoCapturar(foto.base64, descarte);
    } catch {
      capturando.current = false;
      setTirandoFoto(false);
      setErro('Não foi possível tirar a foto. Tente de novo ou use o toque.');
    }
  }

  if (!permissao) {
    return (
      <Tela titulo={titulo} descricao="Verificando a permissão da câmera." acao={acaoVoltar}>
        {null}
      </Tela>
    );
  }

  if (!permissao.granted) {
    return (
      <Tela
        titulo={titulo}
        acao={
          <>
            {permissao.canAskAgain ? (
              <Botao
                titulo="Permitir câmera"
                largura="total"
                onPress={() => void pedirPermissao()}
              />
            ) : null}
            {acaoVoltar}
          </>
        }
      >
        <Cartao titulo="Câmera sem permissão">
          <Text accessibilityRole="alert" style={estilos.mensagem}>
            {permissao.canAskAgain
              ? 'Permita o acesso à câmera para fotografar o cartão, ou volte e use o toque.'
              : 'O acesso à câmera foi negado. Libere nos ajustes do aparelho ou volte e use o toque.'}
          </Text>
        </Cartao>
      </Tela>
    );
  }

  return (
    <Tela
      titulo={titulo}
      descricao="Enquadre a folha inteira, com os 4 marcadores de canto visíveis."
      acao={
        <>
          <Botao
            titulo={pronta ? 'Tirar foto' : 'Preparando câmera'}
            largura="total"
            desabilitado={!pronta}
            carregando={tirandoFoto}
            onPress={() => void tirarFoto()}
          />
          {acaoVoltar}
        </>
      }
    >
      <View style={estilos.visor}>
        <CameraView
          ref={camera}
          style={estilos.camera}
          facing="back"
          mode="picture"
          pictureSize={tamanho}
          onCameraReady={() => void aoFicarPronta()}
        />
      </View>

      {erro ? (
        <Cartao titulo="Foto não capturada">
          <Text accessibilityRole="alert" style={estilos.erro}>
            {erro}
          </Text>
        </Cartao>
      ) : null}
    </Tela>
  );
}

interface PropsDaArea {
  base64: string;
  area: AreaDetectada;
  orientacao: OrientacaoExif;
}

/** Mostra a foto com a area entre os 4 marcadores, para o professor conferir o enquadramento. */
export function AreaNaFoto({ base64, area, orientacao }: PropsDaArea) {
  const [largura, setLargura] = useState(0);
  const exibida = useMemo(() => areaNaFotoExibida(area, orientacao), [area, orientacao]);
  const escala = largura / exibida.largura;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Foto do cartão com a área detectada marcada entre os 4 marcadores"
      onLayout={(evento) => setLargura(evento.nativeEvent.layout.width)}
      style={[estilos.foto, { aspectRatio: exibida.largura / exibida.altura }]}
    >
      <Image
        source={{ uri: `data:image/jpeg;base64,${base64}` }}
        resizeMode="stretch"
        style={StyleSheet.absoluteFill}
      />
      {largura > 0
        ? segmentosDaArea(exibida.cantos, escala).map((segmento, indice) => (
            <View
              key={`lado-${indice}`}
              style={[
                estilos.linha,
                {
                  left: segmento.x - segmento.comprimento / 2,
                  top: segmento.y - ESPESSURA_DA_LINHA / 2,
                  width: segmento.comprimento,
                  transform: [{ rotate: `${segmento.anguloRad}rad` }],
                },
              ]}
            />
          ))
        : null}
      {largura > 0
        ? exibida.cantos.map((canto, indice) => (
            <View
              key={`canto-${indice}`}
              style={[
                estilos.canto,
                {
                  left: canto.x * escala - TAMANHO_DO_CANTO / 2,
                  top: canto.y * escala - TAMANHO_DO_CANTO / 2,
                },
              ]}
            />
          ))
        : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  visor: {
    aspectRatio: 3 / 4,
    borderRadius: raio.lg,
    overflow: 'hidden',
    backgroundColor: cores.foreground,
  },
  camera: { flex: 1 },
  foto: {
    width: '70%',
    alignSelf: 'center',
    borderRadius: raio.md,
    overflow: 'hidden',
    backgroundColor: cores.foreground,
  },
  linha: {
    position: 'absolute',
    height: ESPESSURA_DA_LINHA,
    backgroundColor: cores.primary,
    borderWidth: 1,
    borderColor: cores.primaryForeground,
  },
  canto: {
    position: 'absolute',
    width: TAMANHO_DO_CANTO,
    height: TAMANHO_DO_CANTO,
    borderRadius: raio.pill,
    backgroundColor: cores.primary,
    borderWidth: 2,
    borderColor: cores.primaryForeground,
  },
  mensagem: { fontSize: tipografia.tamanho.md, color: cores.foreground },
  erro: { fontSize: tipografia.tamanho.md, color: cores.destructive },
});
