import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ItemFilaCorrecao, StatusSincronizacao } from '@sgp/shared-types';
import { cores, espacamento, tipografia } from '@sgp/design-tokens';
import { Badge, Botao, Cartao, Tela } from '../components/ui';
import {
  listarFila,
  obterDetalhesDaCorrecaoNaFila,
  tentarNovamente,
  totalPorStatus,
  useEstadoDeCorrecoes,
} from '../lib/estado-de-correcoes';
import type { PropsDaTela } from '../navegacao';

const statusDaFila: Record<
  StatusSincronizacao,
  { texto: string; variante: 'secondary' | 'outline' | 'destructive' }
> = {
  pending: { texto: 'Pendente', variante: 'secondary' },
  synced: { texto: 'Sincronizada · exemplo', variante: 'outline' },
  error: { texto: 'Erro · exemplo', variante: 'destructive' },
};

function formatarData(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(data));
}

function descricaoDaCorrecao(item: ItemFilaCorrecao): string {
  const detalhes = obterDetalhesDaCorrecaoNaFila(item);
  const versao =
    detalhes.versao === undefined ? 'Versão indisponível' : `Versão ${detalhes.versao}`;
  return `${versao} · ${detalhes.identificacao}`;
}

export function FilaCorrecoes({ navigation }: PropsDaTela<'FilaCorrecoes'>) {
  useEstadoDeCorrecoes();
  const fila = listarFila();
  const totais = totalPorStatus();
  const [mensagem, setMensagem] = useState('');

  function reenviar(item: ItemFilaCorrecao) {
    if (!tentarNovamente(item.clientCorrectionId)) {
      setMensagem('Não foi possível simular a tentativa. Atualize a fila e tente novamente.');
      return;
    }
    setMensagem(
      'Tentativa simulada: a correção voltou para pendente. Nenhum dado foi enviado ao servidor.',
    );
  }

  return (
    <Tela
      titulo="Fila de correções"
      descricao="Correções registradas nesta sessão do aplicativo."
      acao={
        <Botao
          titulo="Voltar para aplicações"
          variante="outline"
          largura="total"
          onPress={() => navigation.goBack()}
        />
      }
    >
      <Cartao
        titulo="Fila temporária"
        descricao="Nesta fase, os dados ficam apenas na memória enquanto o aplicativo está aberto. Ao fechar, a fila não é mantida. A sincronização com servidor não está disponível."
      >
        <View style={estilos.resumo}>
          <Badge texto={`${totais.pending} pendentes`} variante="secondary" />
          <Badge texto={`${totais.synced} sincronizadas · exemplo`} variante="outline" />
          <Badge texto={`${totais.error} erros · exemplo`} variante="destructive" />
        </View>
      </Cartao>

      {mensagem ? (
        <Cartao>
          <Text accessibilityRole="alert" style={estilos.mensagem}>
            {mensagem}
          </Text>
        </Cartao>
      ) : null}

      {fila.length === 0 ? (
        <Cartao
          titulo="Nenhuma correção na fila"
          descricao="As correções confirmadas nesta sessão aparecerão aqui."
        >
          {null}
        </Cartao>
      ) : (
        fila.map((item) => {
          const detalhes = obterDetalhesDaCorrecaoNaFila(item);
          const status = statusDaFila[item.syncStatus];

          return (
            <Cartao
              key={item.clientCorrectionId}
              titulo={detalhes.tituloDaProva}
              descricao={descricaoDaCorrecao(item)}
              rotuloAcessivel={`${detalhes.tituloDaProva}, ${descricaoDaCorrecao(item)}`}
            >
              <View style={estilos.metadados}>
                <Badge texto={status.texto} variante={status.variante} />
                <Text style={estilos.data}>Salva em {formatarData(item.capturedAt)}</Text>
              </View>
              {item.syncStatus === 'error' ? (
                <>
                  {item.syncError ? <Text style={estilos.erro}>{item.syncError}</Text> : null}
                  <Botao
                    titulo="Tentar novamente"
                    variante="outline"
                    onPress={() => reenviar(item)}
                  />
                </>
              ) : null}
            </Cartao>
          );
        })
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  resumo: { gap: espacamento.xs },
  metadados: { gap: espacamento.sm },
  data: { fontSize: tipografia.tamanho.sm, color: cores.mutedForeground },
  erro: { fontSize: tipografia.tamanho.sm, color: cores.destructive },
  mensagem: { fontSize: tipografia.tamanho.sm, color: cores.foreground },
});
