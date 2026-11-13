import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * A tela cria a turma em branco e leva o professor ao detalhe para preenche-la, por
 * isso nome, disciplina e periodo aceitam texto vazio aqui. O id pode vir do navegador
 * para a tela seguir sincrona enquanto a requisicao viaja.
 */
export class CriarTurmaDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  @MaxLength(160)
  subject!: string;

  @IsString()
  @MaxLength(16)
  term!: string;
}

export class AtualizarTurmaDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  @MaxLength(160)
  subject!: string;

  @IsString()
  @MaxLength(16)
  term!: string;
}

/** RF03: o professor matricula, por e-mail, um estudante ja cadastrado. */
export class MatricularPorEmailDto {
  // E-mail colado costuma vir com espaco nas pontas; sem isto, @IsEmail recusaria.
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'Informe um e-mail valido.' })
  @MaxLength(254)
  email!: string;
}
