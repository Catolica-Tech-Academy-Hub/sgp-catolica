import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MENSAGENS_DO_QR, validarQr } from './leitura-do-qr.ts';

// Valores neutros: nenhum dado de aluno real nem o formato definitivo do QR (#91).
const entrada = (sobrescrita = {}) => ({
  qrCodePayload: 'qr-a',
  applicationId: 'aplicacao-1',
  examVersionId: 'versao-1',
  studentId: 'aluno-1',
  nomeDoAluno: 'Aluno ficticio',
  jaCorrigida: false,
  temGabarito: true,
  ...sobrescrita,
});

describe('validacao do QR Code', () => {
  it('identifica versao e aluno de uma prova com identificacao', () => {
    assert.deepEqual(validarQr('qr-a', 'aplicacao-1', [entrada()]), {
      ok: true,
      prova: { examVersionId: 'versao-1', studentId: 'aluno-1', nomeDoAluno: 'Aluno ficticio' },
    });
  });

  it('prova sem identificacao identifica somente a versao', () => {
    const anonima = entrada({ studentId: undefined, nomeDoAluno: 'Prova sem identificacao' });
    const resultado = validarQr('qr-a', 'aplicacao-1', [anonima]);
    assert.equal(resultado.ok, true);
    assert.equal(resultado.prova.examVersionId, 'versao-1');
    assert.equal(resultado.prova.studentId, undefined);
  });

  it('trata o valor como opaco, com qualquer formato', () => {
    const conteudo = '{"v":1}|a/b?c=d ç';
    const resultado = validarQr(conteudo, 'aplicacao-1', [entrada({ qrCodePayload: conteudo })]);
    assert.equal(resultado.ok, true);
  });

  for (const conteudo of ['QR-A', 'qr-a ', ' qr-a', 'qr']) {
    it(`compara por igualdade exata: "${conteudo}" nao e reconhecido`, () => {
      assert.deepEqual(validarQr(conteudo, 'aplicacao-1', [entrada()]), {
        ok: false,
        motivo: 'nao_reconhecido',
      });
    });
  }

  for (const [nome, conteudo] of [
    ['vazio', ''],
    ['ausente', undefined],
    ['nulo', null],
    ['numerico', 123],
    ['maior que a coluna do banco', 'x'.repeat(256)],
  ]) {
    it(`conteudo ${nome} e ilegivel`, () => {
      assert.deepEqual(validarQr(conteudo, 'aplicacao-1', [entrada()]), {
        ok: false,
        motivo: 'ilegivel',
      });
    });
  }

  it('aceita o tamanho maximo da coluna do banco', () => {
    const conteudo = 'x'.repeat(255);
    const resultado = validarQr(conteudo, 'aplicacao-1', [entrada({ qrCodePayload: conteudo })]);
    assert.equal(resultado.ok, true);
  });

  it('recusa QR desconhecido', () => {
    assert.deepEqual(validarQr('qr-b', 'aplicacao-1', [entrada()]), {
      ok: false,
      motivo: 'nao_reconhecido',
    });
  });

  it('recusa valor repetido em vez de escolher uma das provas', () => {
    const repetidas = [entrada(), entrada({ studentId: 'aluno-2' })];
    assert.deepEqual(validarQr('qr-a', 'aplicacao-1', repetidas), {
      ok: false,
      motivo: 'nao_reconhecido',
    });
  });

  it('recusa QR de outra aplicacao', () => {
    assert.deepEqual(validarQr('qr-a', 'aplicacao-2', [entrada()]), {
      ok: false,
      motivo: 'outra_aplicacao',
    });
  });

  it('nao informa dados de prova de outra aplicacao ja corrigida', () => {
    assert.deepEqual(validarQr('qr-a', 'aplicacao-2', [entrada({ jaCorrigida: true })]), {
      ok: false,
      motivo: 'outra_aplicacao',
    });
  });

  it('nao reabre prova ja corrigida', () => {
    assert.deepEqual(validarQr('qr-a', 'aplicacao-1', [entrada({ jaCorrigida: true })]), {
      ok: false,
      motivo: 'ja_corrigida',
    });
  });

  it('recusa versao sem gabarito local', () => {
    assert.deepEqual(validarQr('qr-a', 'aplicacao-1', [entrada({ temGabarito: false })]), {
      ok: false,
      motivo: 'sem_gabarito',
    });
  });

  it('toda recusa tem mensagem clara', () => {
    for (const motivo of [
      'ilegivel',
      'nao_reconhecido',
      'outra_aplicacao',
      'ja_corrigida',
      'sem_gabarito',
    ]) {
      assert.ok(MENSAGENS_DO_QR[motivo].length > 0);
    }
  });
});
