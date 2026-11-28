import { Module } from '@nestjs/common';
import { CadastroController } from './cadastro.controller';
import { CadastroService } from './cadastro.service';

@Module({
  controllers: [CadastroController],
  providers: [CadastroService],
})
export class UsuariosModule {}
