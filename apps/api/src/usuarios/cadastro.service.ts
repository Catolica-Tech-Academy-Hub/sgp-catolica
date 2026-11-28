import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Estudante, Professor } from '@sgp/shared-types';
import { ehViolacaoDeUnicidade } from '../prisma/erros';
import { PrismaService } from '../prisma/prisma.service';
import type { CadastroDto } from './cadastro.dto';
import { emailDoPapel, mensagemDeDominio, normalizarEmail } from './regras';
import { gerarHashDeSenha } from './senha';

/**
 * RF01 (#80): cadastro de professor e de estudante. Nao abre sessao: o login e a
 * emissao de tokens sao da #81, e a tela leva quem se cadastrou para a entrada.
 */
@Injectable()
export class CadastroService {
  constructor(private readonly prisma: PrismaService) {}

  async cadastrar(dados: CadastroDto): Promise<Professor | Estudante> {
    const email = normalizarEmail(dados.email);
    if (!emailDoPapel(email, dados.role)) {
      throw new BadRequestException(mensagemDeDominio(dados.role));
    }

    const passwordHash = await gerarHashDeSenha(dados.password);
    const registration = dados.role === 'estudante' ? dados.registration || null : null;

    try {
      const usuario = await this.prisma.usuario.create({
        data: { role: dados.role, fullName: dados.fullName, email, registration, passwordHash },
      });

      // Nunca devolve o hash.
      const base = {
        id: usuario.id,
        fullName: usuario.fullName,
        email: usuario.email,
        createdAt: usuario.createdAt.toISOString(),
      };
      return usuario.role === 'estudante'
        ? { ...base, role: 'estudante', registration: usuario.registration ?? undefined }
        : { ...base, role: 'professor' };
    } catch (erro) {
      // A unicidade do banco decide, inclusive entre dois cadastros simultaneos.
      if (ehViolacaoDeUnicidade(erro)) {
        throw new ConflictException(
          'Ja existe uma conta com este e-mail ou matricula. Entre com ela.',
        );
      }
      throw erro;
    }
  }
}
