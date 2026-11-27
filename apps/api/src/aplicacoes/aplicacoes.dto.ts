import { IsBoolean, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

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
