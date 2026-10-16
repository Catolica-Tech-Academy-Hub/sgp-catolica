import { Module } from '@nestjs/common';
import { MatriculasController, TurmasController } from './turmas.controller';
import { TurmasService } from './turmas.service';

@Module({
  controllers: [TurmasController, MatriculasController],
  providers: [TurmasService],
})
export class TurmasModule {}
