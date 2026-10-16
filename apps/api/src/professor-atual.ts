/**
 * Professor dono dos dados enquanto nao existe autenticacao.
 *
 * Ponto de integracao explicito: quando JWT e refresh token existirem (RNF04), este id
 * passa a vir do token da requisicao, e nenhum servico deve depender de outra coisa
 * alem desta constante para saber quem e o professor.
 */
export const PROFESSOR_ATUAL_ID = 'prof-1';
