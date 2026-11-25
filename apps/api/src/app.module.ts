import { Module } from '@nestjs/common';
import { AplicacoesModule } from './aplicacoes/aplicacoes.module';
import { EstudantesModule } from './estudantes/estudantes.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProvasModule } from './provas/provas.module';
import { QuestoesModule } from './questoes/questoes.module';
import { SaudeController } from './saude.controller';
import { TurmasModule } from './turmas/turmas.module';

@Module({
  imports: [
    PrismaModule,
    TurmasModule,
    EstudantesModule,
    QuestoesModule,
    ProvasModule,
    AplicacoesModule,
  ],
  controllers: [SaudeController],
})
export class AppModule {}
