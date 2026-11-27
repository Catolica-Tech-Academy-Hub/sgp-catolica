import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CriarAplicacaoDto {
  @IsString()
  @MaxLength(64)
  examId!: string;

  @IsString()
  @MaxLength(64)
  classId!: string;
}

export class GerarVersoesDto {
  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;

  @IsBoolean()
  shuffleQuestions!: boolean;

  @IsBoolean()
  shuffleAlternatives!: boolean;

  @IsBoolean()
  withStudentIdentification!: boolean;
}

export class CamposCabecalhoPdfDto {
  @IsBoolean()
  nome!: boolean;

  @IsBoolean()
  matricula!: boolean;

  @IsBoolean()
  turma!: boolean;

  @IsBoolean()
  data!: boolean;

  @IsBoolean()
  nota!: boolean;
}

export class CabecalhoPdfDto {
  @IsString()
  @MaxLength(160)
  instituicao!: string;

  @IsString()
  @MaxLength(240)
  linhaComplementar!: string;

  @IsString()
  @MaxLength(160)
  professor!: string;

  @IsString()
  @MaxLength(2000)
  instrucoes!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => CamposCabecalhoPdfDto)
  campos!: CamposCabecalhoPdfDto;
}

export class GerarPdfDto extends GerarVersoesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CabecalhoPdfDto)
  cabecalho?: CabecalhoPdfDto;
}
