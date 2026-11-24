import { Module } from '@nestjs/common';
import { CorrecoesModule } from '../correcoes/correcoes.module';
import { AplicacoesController } from './aplicacoes.controller';
import { AplicacoesService } from './aplicacoes.service';

@Module({
  imports: [CorrecoesModule],
  controllers: [AplicacoesController],
  providers: [AplicacoesService],
})
export class AplicacoesModule {}
