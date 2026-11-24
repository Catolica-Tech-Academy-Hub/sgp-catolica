import { ArrayMaxSize, ArrayMinSize, IsArray } from 'class-validator';

/** Teto do lote: a fila de uma turma cabe com folga e o corpo continua pequeno. */
export const MAXIMO_DE_ITENS_POR_LOTE = 200;

/**
 * Corpo de `POST /correcoes/lote`. Os itens nao sao validados aqui de proposito: cada
 * `ItemFilaCorrecao` e conferido pelo servico, para um item ruim virar erro so dele
 * (status por item, RF08) em vez de recusar o lote inteiro.
 */
export class SincronizarLoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAXIMO_DE_ITENS_POR_LOTE)
  itens!: unknown[];
}
