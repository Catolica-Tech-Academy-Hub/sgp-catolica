import { Module } from '@nestjs/common';
import { ConvitesController } from './convites.controller';
import { ConvitesService } from './convites.service';
import { CREDENCIAIS_DO_ESTUDANTE, CredenciaisIndisponiveis } from './credenciais';

@Module({
  controllers: [ConvitesController],
  providers: [
    ConvitesService,
    // Troca pela implementacao real quando o login (#81) existir.
    { provide: CREDENCIAIS_DO_ESTUDANTE, useClass: CredenciaisIndisponiveis },
  ],
})
export class ConvitesModule {}
