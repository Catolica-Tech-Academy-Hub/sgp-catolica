import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ItemFilaCorrecao, StatusSincronizacao } from '@sgp/shared-types';
import { cores, espacamento, tipografia } from '@sgp/design-tokens';
import { Badge, Botao, Cartao, Tela } from '../components/ui';
import {
  listarFila,
  obterDetalhesDaCorrecaoNaFila,
  sincronizarFila,
  tentarNovamente,
  totalPorStatus,
  useEstadoDeCorrecoes,
} from '../lib/estado-de-correcoes';
import { urlDaApi } from '../lib/sincronizacao';
import type { PropsDaTela } from '../navegacao';

const statusDaFila: Record<
  StatusSincronizacao,
  { texto: string; variante: 'secondary' | 'outline' | 'destructive' }
> = {
  pending: { texto: 'Pendente', variante: 'secondary' },
  synced: { texto: 'Sincronizada', variante: 'outline' },
  error: { texto: 'Erro', variante: 'destructive' },
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
  const [enviando, setEnviando] = useState(false);
  const apiLigada = urlDaApi() !== undefined;

  async function sincronizar() {
    setEnviando(true);
    setMensagem('');
    const resumo = await sincronizarFila();
    setEnviando(false);
    if (!resumo.ok) {
      setMensagem(
        resumo.motivo === 'sem_conexao'
          ? 'Sem conexão com o servidor. As correções continuam salvas no aparelho; tente de novo.'
          : resumo.motivo === 'sem_api'
            ? 'O aplicativo não foi configurado com o endereço do servidor.'
            : `O servidor recusou o envio${resumo.detalhe ? ` (${resumo.detalhe})` : ''}.`,
      );
      return;
    }
    setMensagem(
      resumo.enviadas === 0
        ? 'Nenhuma correção deste aparelho para enviar.'
        : `${resumo.sincronizadas} sincronizada(s), ${resumo.erros} com erro, de ${resumo.enviadas} enviada(s).`,
    );
  }

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
        descricao={
          apiLigada
            ? 'As correções ficam salvas no aparelho e são enviadas ao servidor quando você sincroniza.'
            : 'As correções ficam salvas no aparelho. O aplicativo não foi configurado com o endereço do servidor, então a sincronização não está disponível.'
        }
      >
        <View style={estilos.resumo}>
          <Badge texto={`${totais.pending} pendentes`} variante="secondary" />
          <Badge texto={`${totais.synced} sincronizadas`} variante="outline" />
          <Badge texto={`${totais.error} erros`} variante="destructive" />
        </View>
        {apiLigada ? (
          <Botao
            titulo={enviando ? 'Enviando…' : 'Sincronizar com o servidor'}
            largura="total"
            desabilitado={enviando}
            onPress={() => void sincronizar()}
          />
        ) : null}
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
