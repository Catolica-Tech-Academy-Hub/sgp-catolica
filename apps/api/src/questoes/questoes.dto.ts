import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type { TipoQuestao } from '@sgp/shared-types';

export class AlternativaDto {
  @IsString()
  @MaxLength(64)
  id!: string;

  @IsString()
  @MaxLength(2000)
  text!: string;
}

/**
 * Corpo do salvamento de uma questao. As regras que dependem do tipo (quantidade de
 * alternativas, alternativa correta, pontuacao maxima) ficam no servico, porque
 * cruzam campos.
 */
export class SalvarQuestaoDto {
  @IsIn(['objetiva', 'discursiva'])
  type!: TipoQuestao;

  @IsString()
  @MaxLength(10000)
  statement!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  tags!: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlternativaDto)
  alternatives?: AlternativaDto[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  correctAlternativeId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  maxScore?: number;
}
