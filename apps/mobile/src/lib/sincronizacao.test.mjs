import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { enviarLote } from './sincronizacao.ts';

const item = { clientCorrectionId: 'local-1' };

function resposta(corpo, ok = true, status = 200) {
  return { ok, status, json: async () => corpo };
}

describe('enviarLote', () => {
  it('nao envia nada sem o endereco da API', async () => {
    let chamou = false;
    const r = await enviarLote([item], {
      url: undefined,
      requisitar: async () => ((chamou = true), resposta({})),
    });
    // Sem `url` e sem EXPO_PUBLIC_API_URL no ambiente do teste.
    assert.deepEqual(r, { ok: false, motivo: 'sem_api' });
    assert.equal(chamou, false);
  });

  it('envia o lote para /correcoes/lote e devolve o resultado de cada item', async () => {
    let chamada;
    const r = await enviarLote([item], {
      url: 'https://api.exemplo',
      requisitar: async (url, opcoes) => {
        chamada = { url, opcoes };
        return resposta({ resultados: [{ clientCorrectionId: 'local-1', syncStatus: 'synced' }] });
      },
    });
    assert.equal(chamada.url, 'https://api.exemplo/correcoes/lote');
    assert.equal(chamada.opcoes.method, 'POST');
    assert.deepEqual(JSON.parse(chamada.opcoes.body), { itens: [item] });
    assert.deepEqual(r, {
      ok: true,
      resultados: [{ clientCorrectionId: 'local-1', syncStatus: 'synced' }],
    });
  });

  it('mantem o erro de um item sem perder os demais', async () => {
    const r = await enviarLote([item], {
      url: 'https://api.exemplo',
      requisitar: async () =>
        resposta({
          resultados: [
            {
              clientCorrectionId: 'local-1',
              syncStatus: 'error',
              syncError: 'Versao inexistente.',
            },
            { syncStatus: 'invalido' },
          ],
        }),
    });
    assert.equal(r.ok, true);
    assert.equal(r.resultados.length, 1);
    assert.equal(r.resultados[0].syncError, 'Versao inexistente.');
  });

  it('trata falha de rede como sem conexao, sem lancar', async () => {
    const r = await enviarLote([item], {
      url: 'https://api.exemplo',
      requisitar: async () => {
        throw new Error('rede');
      },
    });
    assert.deepEqual(r, { ok: false, motivo: 'sem_conexao' });
  });

  it('recusa resposta com status de erro ou formato inesperado', async () => {
    const http = await enviarLote([item], {
      url: 'https://api.exemplo',
      requisitar: async () => resposta({}, false, 500),
    });
    assert.deepEqual(http, { ok: false, motivo: 'recusado', detalhe: 'HTTP 500' });
    const formato = await enviarLote([item], {
      url: 'https://api.exemplo',
      requisitar: async () => resposta({ outra: 1 }),
    });
    assert.equal(formato.ok, false);
    assert.equal(formato.motivo, 'recusado');
  });
});
