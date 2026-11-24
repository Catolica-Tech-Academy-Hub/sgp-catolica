import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Cadastro feito na entrada pelo convite, por quem ainda nao tem conta (RF03). O dominio
 * de estudante e conferido no servico, junto da regra de e-mail ja usado.
 */
export class CadastroPeloConviteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  fullName!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** Matricula academica, quando o estudante a informa. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  registration?: string;

  /** Mesmo minimo da tela de login (RF01). */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
