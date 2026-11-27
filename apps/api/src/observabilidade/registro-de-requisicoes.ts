import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger-json';

const CABECALHO_DO_ID = 'X-Request-Id';

/** Id vindo de fora so e aceito se for curto e simples, para nao injetar lixo no log. */
const ID_ACEITAVEL = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Uma linha por requisicao, quando a resposta termina: id, metodo, rota, status e
 * duracao (RNF07).
 *
 * O id vem do cabecalho `X-Request-Id` quando o cliente manda um, ou e gerado aqui, e
 * volta na resposta: com ele, um erro relatado pela tela pode ser achado no log.
 *
 * A rota e o padrao do Nest (`/turmas/:id/matriculas`), nao o caminho com os ids, para
 * as linhas da mesma rota serem agrupaveis. Sem rota casada (404), fica o caminho sem a
 * query string.
 */
export function registrarRequisicoes(req: Request, res: Response, next: NextFunction): void {
  const recebido = req.header(CABECALHO_DO_ID);
  const requisicaoId = recebido && ID_ACEITAVEL.test(recebido) ? recebido : randomUUID();
  res.setHeader(CABECALHO_DO_ID, requisicaoId);

  const inicio = process.hrtime.bigint();
  let registrada = false;

  const registrar = (concluida: boolean): void => {
    if (registrada) return;
    registrada = true;

    const duracaoMs = Number(process.hrtime.bigint() - inicio) / 1e6;
    const rota = req.route?.path ? `${req.baseUrl}${String(req.route.path)}` : req.path;
    // Conexao fechada antes da resposta: o cliente desistiu (aba fechada, timeout).
    const status = concluida ? res.statusCode : 499;

    logger[status >= 500 ? 'error' : 'log']({
      tipo: 'requisicao',
      requisicaoId,
      metodo: req.method,
      rota,
      status,
      duracaoMs: Math.round(duracaoMs * 10) / 10,
    });
  };

  res.on('finish', () => registrar(true));
  res.on('close', () => registrar(res.writableFinished));
  next();
}
