import { Module } from '@nestjs/common';
import { EstudantesController } from './estudantes.controller';
import { EstudantesService } from './estudantes.service';

@Module({
  controllers: [EstudantesController],
  providers: [EstudantesService],
})
export class EstudantesModule {}
