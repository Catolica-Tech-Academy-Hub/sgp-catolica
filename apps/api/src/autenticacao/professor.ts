import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { RequisicaoIdentificada } from './usuario-autenticado';

/**
 * Id do professor dono da requisicao. Sem usuario identificado responde 401; com um
 * usuario que nao e professor, 403. Os servicos recebem esse id e filtram por ele: nenhum
 * modulo decide sozinho quem e o professor.
 */
export function idDoProfessor(requisicao: RequisicaoIdentificada): string {
  const usuario = requisicao.usuario;
  if (!usuario) throw new UnauthorizedException('Autenticacao necessaria.');
  if (usuario.role !== 'professor') throw new ForbiddenException('Rota exclusiva do professor.');
  return usuario.id;
}

function requisicaoDe(contexto: ExecutionContext): RequisicaoIdentificada {
  return contexto.switchToHttp().getRequest<RequisicaoIdentificada>();
}

/** Recusa a rota antes do controller para quem nao e professor (RNF04). */
@Injectable()
export class ApenasProfessorGuard implements CanActivate {
  canActivate(contexto: ExecutionContext): boolean {
    idDoProfessor(requisicaoDe(contexto));
    return true;
  }
}

/** Injeta no parametro do controller o id do professor da requisicao. */
export const ProfessorAtual = createParamDecorator((_dado: unknown, contexto: ExecutionContext) =>
  idDoProfessor(requisicaoDe(contexto)),
);
