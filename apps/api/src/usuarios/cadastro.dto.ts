import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { PapelUsuario } from '@sgp/shared-types';
import { SENHA_MAXIMA, SENHA_MINIMA } from './regras';

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * RF01: cadastro separado por tipo, com nome completo, e-mail e senha. O dominio do
 * e-mail por tipo e o e-mail unico sao conferidos no servico, porque cruzam campos ou
 * dependem do banco.
 */
export class CadastroDto {
  @IsIn(['professor', 'estudante'], { message: 'Escolha professor ou estudante.' })
  role!: PapelUsuario;

  @Transform(aparar)
  @IsString()
  @MinLength(3, { message: 'Informe o nome completo.' })
  @MaxLength(160)
  fullName!: string;

  @Transform(aparar)
  @IsEmail({}, { message: 'Informe um e-mail valido.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(SENHA_MINIMA, { message: `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.` })
  @MaxLength(SENHA_MAXIMA, { message: `A senha pode ter no maximo ${SENHA_MAXIMA} caracteres.` })
  password!: string;

  /** Matricula academica do estudante, quando ele a informa; ignorada para professor. */
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(32)
  registration?: string;
}
