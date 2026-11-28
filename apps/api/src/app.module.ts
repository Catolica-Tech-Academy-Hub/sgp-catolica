import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AplicacoesModule } from './aplicacoes/aplicacoes.module';
import { IdentificacaoProvisoriaGuard } from './autenticacao/identificacao-provisoria';
import { CorrecoesModule } from './correcoes/correcoes.module';
import { ConvitesModule } from './convites/convites.module';
import { EstudantesModule } from './estudantes/estudantes.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProvasModule } from './provas/provas.module';
import { QuestoesModule } from './questoes/questoes.module';
import { SaudeController } from './saude.controller';
import { TurmasModule } from './turmas/turmas.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    PrismaModule,
    TurmasModule,
    EstudantesModule,
    QuestoesModule,
    ProvasModule,
    AplicacoesModule,
    CorrecoesModule,
    ConvitesModule,
    UsuariosModule,
  ],
  controllers: [SaudeController],
  providers: [{ provide: APP_GUARD, useClass: IdentificacaoProvisoriaGuard }],
})
export class AppModule {}
