import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AplicacoesController } from './aplicacoes.controller';
import { AplicacoesService } from './aplicacoes.service';

@Module({
  imports: [PrismaModule],
  controllers: [AplicacoesController],
  providers: [AplicacoesService],
})
export class AplicacoesModule {}
