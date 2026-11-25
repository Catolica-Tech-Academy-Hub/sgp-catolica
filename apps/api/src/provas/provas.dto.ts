import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { StatusProva } from '@sgp/shared-types';

/** Limite de questoes por prova definido em RF04. */
export const MAXIMO_DE_QUESTOES = 20;

export class QuestaoDaProvaDto {
  @IsString()
  @MaxLength(64)
  questionId!: string;

  @IsInt()
  @Min(1)
  order!: number;

  /** A soma nao e validada (RF04); so nao pode ser negativa. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  score!: number;
}

/**
 * Corpo do salvamento de uma prova. A tela cria a prova em branco e leva o professor ao
 * editor, por isso o titulo aceita texto vazio aqui, como a turma.
 */
export class SalvarProvaDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsIn(['draft', 'ready', 'closed'])
  status!: StatusProva;

  @IsArray()
  @ArrayMaxSize(MAXIMO_DE_QUESTOES)
  @ValidateNested({ each: true })
  @Type(() => QuestaoDaProvaDto)
  questions!: QuestaoDaProvaDto[];

  /**
   * Layout do editor (issue #12). A API guarda como chega: o formato dos blocos ainda
   * e prototipo da web e nao faz parte do dominio aprovado.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsObject({ each: true })
  blocos?: Record<string, unknown>[];
}
