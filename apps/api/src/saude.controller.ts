import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

/** Verificacao de vida da API e da conexao com o banco. */
@Controller('saude')
export class SaudeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async verificar(): Promise<{ status: 'ok'; banco: 'ok' }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', banco: 'ok' };
  }
}
