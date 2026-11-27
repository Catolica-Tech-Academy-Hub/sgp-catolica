import { Module } from '@nestjs/common';
import { CorrecoesController } from './correcoes.controller';
import { CorrecoesService } from './correcoes.service';

@Module({
  controllers: [CorrecoesController],
  providers: [CorrecoesService],
})
export class CorrecoesModule {}
