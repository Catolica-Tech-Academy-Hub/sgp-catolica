import type { LoggerService, LogLevel } from '@nestjs/common';

/**
 * Logs estruturados (RNF07): uma linha JSON por evento, no lugar do log colorido padrao
 * do Nest. O Render guarda a saida do processo, e JSON pode ser filtrado por campo
 * (nivel, requisicaoId, status) em vez de lido como texto.
 *
 * Nunca registra corpo, query string nem cabecalhos de requisicao: o corpo da
 * matricula leva o e-mail do estudante, e depois da autenticacao os cabecalhos levam
 * o token (RNF05).
 */
export class LoggerJson implements LoggerService {
  log(mensagem: unknown, ...extras: unknown[]): void {
    this.escrever('log', mensagem, extras);
  }

  error(mensagem: unknown, ...extras: unknown[]): void {
    this.escrever('error', mensagem, extras);
  }

  warn(mensagem: unknown, ...extras: unknown[]): void {
    this.escrever('warn', mensagem, extras);
  }

  debug(mensagem: unknown, ...extras: unknown[]): void {
    this.escrever('debug', mensagem, extras);
  }

  verbose(mensagem: unknown, ...extras: unknown[]): void {
    this.escrever('verbose', mensagem, extras);
  }

  fatal(mensagem: unknown, ...extras: unknown[]): void {
    this.escrever('fatal', mensagem, extras);
  }

  /**
   * O Nest passa o contexto (nome da classe) como ultimo argumento e, em `error`, a
   * pilha antes dele. Objetos viram campos da linha, para `registrarRequisicao` poder
   * mandar os dados da requisicao como campos e nao como texto.
   */
  private escrever(nivel: LogLevel, mensagem: unknown, extras: unknown[]): void {
    const textos = extras.filter((extra): extra is string => typeof extra === 'string');
    const contexto = textos.length ? textos[textos.length - 1] : undefined;
    const pilha = nivel === 'error' || nivel === 'fatal' ? textos[textos.length - 2] : undefined;

    const linha: Record<string, unknown> = {
      momento: new Date().toISOString(),
      nivel,
      ...(contexto ? { contexto } : {}),
    };

    if (mensagem instanceof Error) {
      linha.mensagem = mensagem.message;
      linha.pilha = mensagem.stack;
    } else if (typeof mensagem === 'object' && mensagem !== null) {
      Object.assign(linha, mensagem);
    } else {
      linha.mensagem = String(mensagem);
    }
    if (pilha) linha.pilha = pilha;

    const saida = nivel === 'error' || nivel === 'fatal' ? process.stderr : process.stdout;
    saida.write(`${JSON.stringify(linha)}\n`);
  }
}

/** Instancia unica: a mesma do Nest e a do registro de requisicoes. */
export const logger = new LoggerJson();
