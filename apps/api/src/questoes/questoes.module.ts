import { Module } from '@nestjs/common';
import { QuestoesController } from './questoes.controller';
import { QuestoesService } from './questoes.service';

@Module({
  controllers: [QuestoesController],
  providers: [QuestoesService],
})
export class QuestoesModule {}
