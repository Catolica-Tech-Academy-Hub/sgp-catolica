/**
 * Estado do acervo de turmas, compartilhado entre `/turmas` e `/turmas/:id`.
 *
 * Segue o mesmo formato de `estado-de-provas.ts`: um módulo único e reativo, não um
 * gerenciador de estado real. Nenhuma tela deve importar `@sgp/mocks` diretamente para
 * ler, criar ou alterar uma turma ou ler um estudante; deve passar por aqui.
 *
 * Com a API ligada (`VITE_API_URL`, ver `api.ts`), turmas, matrículas e estudantes vêm
 * do servidor por `carregarTurmasDoServidor`, chamada antes de montar a aplicação, e
 * cada alteração é gravada lá (RF03).
 *
 * Sem a API, grava em `localStorage` pelo mesmo motivo de `estado-de-provas.ts`:
 * sobreviver ao F5 sem virar banco de dados. A chave é versionada; mudar o formato de
 * `Turma`/`Matricula` exige subir o `v`.
 */
import { reactive, watch } from 'vue';
import { estudantesMock, matriculasMock, turmasMock } from '@sgp/mocks';
import type { Estudante, Matricula, Turma } from '@sgp/shared-types';
import { apiLigada, enfileirar, enviarAoServidor, requisitar } from './api';

const CHAVE = 'sgp:estado-de-turmas:v1';

interface EstadoGravado {
  turmas: Turma[];
  matriculas: Matricula[];
}

function apartirDosMocks(): EstadoGravado {
  return {
    turmas: turmasMock.map((turma) => ({ ...turma })),
    matriculas: matriculasMock.map((matricula) => ({ ...matricula })),
  };
}

/** Leitura tolerante: qualquer coisa fora do formato esperado volta para os mocks. */
function ler(): EstadoGravado {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return apartirDosMocks();

    const lido = JSON.parse(bruto) as Partial<EstadoGravado>;
    if (!Array.isArray(lido.turmas) || !Array.isArray(lido.matriculas)) return apartirDosMocks();

    return { turmas: lido.turmas, matriculas: lido.matriculas };
  } catch {
    // localStorage indisponível (janela privada, cookies bloqueados) ou JSON inválido:
    // a aplicação segue funcionando, só sem sobreviver à recarga.
    return apartirDosMocks();
  }
}

// Com a API ligada, tudo começa vazio e é preenchido pelo servidor.
const inicial: EstadoGravado = apiLigada ? { turmas: [], matriculas: [] } : ler();

export const turmasNoNavegador = reactive<Turma[]>(inicial.turmas);
export const matriculasNoNavegador = reactive<Matricula[]>(inicial.matriculas);
const estudantesNoNavegador = reactive<Estudante[]>(
  apiLigada ? [] : estudantesMock.map((estudante) => ({ ...estudante })),
);

function gravar(): void {
  try {
    window.localStorage.setItem(
      CHAVE,
      JSON.stringify({ turmas: turmasNoNavegador, matriculas: matriculasNoNavegador }),
    );
  } catch {
    // Cota estourada ou armazenamento bloqueado: não vale derrubar a tela por isso.
  }
}

if (!apiLigada) watch([turmasNoNavegador, matriculasNoNavegador], gravar, { deep: true });

/** Substitui o acervo pelo que o servidor tem. Só faz sentido com a API ligada. */
export async function carregarTurmasDoServidor(): Promise<void> {
  const [turmas, matriculas, estudantes] = await Promise.all([
    requisitar<Turma[]>('/turmas'),
    requisitar<Matricula[]>('/matriculas'),
    requisitar<Estudante[]>('/estudantes'),
  ]);
  turmasNoNavegador.splice(0, turmasNoNavegador.length, ...turmas);
  matriculasNoNavegador.splice(0, matriculasNoNavegador.length, ...matriculas);
  estudantesNoNavegador.splice(0, estudantesNoNavegador.length, ...estudantes);
}

/** Grava uma alteração já aplicada na memória e sincroniza a turma com a resposta. */
function enviarTurma(caminho: string, opcoes: RequestInit): void {
  if (!apiLigada) return;
  enviarAoServidor(
    () => requisitar<Turma>(caminho, opcoes),
    carregarTurmasDoServidor,
    (resposta) => {
      const turma = encontrarTurma(resposta.id);
      if (turma) Object.assign(turma, resposta);
    },
  );
}

function enviarMatricula(caminho: string, opcoes: RequestInit): void {
  if (!apiLigada) return;
  enviarAoServidor(() => requisitar<Matricula>(caminho, opcoes), carregarTurmasDoServidor);
}

export function listarTurmas(): Turma[] {
  return turmasNoNavegador;
}

export function encontrarTurma(id: string): Turma | undefined {
  return turmasNoNavegador.find((turma) => turma.id === id);
}

export function encontrarEstudante(id: string): Estudante | undefined {
  return estudantesNoNavegador.find((estudante) => estudante.id === id);
}

/** Alunos com matrícula ativa numa turma, na ordem em que se matricularam. */
export function listarMatriculasDaTurma(classId: string): Matricula[] {
  return matriculasNoNavegador
    .filter((matricula) => matricula.classId === classId && matricula.status === 'active')
    .sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt));
}

/**
 * Sem caracteres ambíguos (0/O, 1/I) para o código ser legível quando ditado ou copiado.
 * Só no modo local: com a API, quem gera o código é o servidor.
 */
function gerarCodigoDeConvite(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let sufixo = '';
  for (let indice = 0; indice < 4; indice += 1) {
    sufixo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return `TURMA-${new Date().getFullYear()}-${sufixo}`;
}

export function criarTurma(): Turma {
  const turma: Turma = {
    // Com a API, o id nasce aqui para a tela navegar ao detalhe sem esperar a resposta.
    id: apiLigada ? crypto.randomUUID() : `turma-local-${Date.now()}`,
    teacherId: 'prof-1',
    name: '',
    subject: '',
    term: '',
    status: 'active',
    // Com a API, fica vazio por um instante até a resposta trazer o código do servidor.
    inviteCode: apiLigada ? '' : gerarCodigoDeConvite(),
    createdAt: new Date().toISOString(),
  };
  turmasNoNavegador.unshift(turma);
  enviarTurma('/turmas', {
    method: 'POST',
    body: JSON.stringify({ id: turma.id, name: '', subject: '', term: '' }),
  });
  return turma;
}

export function atualizarTurma(
  id: string,
  dados: { name: string; subject: string; term: string },
): void {
  const turma = encontrarTurma(id);
  if (!turma) return;
  turma.name = dados.name;
  turma.subject = dados.subject;
  turma.term = dados.term;
  enviarTurma(`/turmas/${id}`, { method: 'PATCH', body: JSON.stringify(dados) });
}

export function arquivarTurma(id: string): void {
  const turma = encontrarTurma(id);
  if (!turma) return;
  turma.status = 'archived';
  enviarTurma(`/turmas/${id}/arquivar`, { method: 'POST' });
}

/**
 * Assíncrona porque, com a API, o novo código só existe depois da resposta: mostrar um
 * código provisório faria o professor copiar um convite que não vale.
 */
export async function regenerarCodigoDeConvite(id: string): Promise<string | undefined> {
  const turma = encontrarTurma(id);
  if (!turma) return undefined;

  if (!apiLigada) {
    turma.inviteCode = gerarCodigoDeConvite();
    return turma.inviteCode;
  }

  const resposta = await enfileirar(() =>
    requisitar<Turma>(`/turmas/${id}/codigo-de-convite`, { method: 'POST' }),
  );
  Object.assign(turma, resposta);
  return turma.inviteCode;
}

export function removerMatricula(matriculaId: string): void {
  const matricula = matriculasNoNavegador.find((item) => item.id === matriculaId);
  if (!matricula) return;
  matricula.status = 'removed';
  enviarMatricula(`/matriculas/${matriculaId}`, { method: 'DELETE' });
}

/** Desfaz `removerMatricula`, chamada pela ação "Desfazer" do toast. */
export function restaurarMatricula(matriculaId: string): void {
  const matricula = matriculasNoNavegador.find((item) => item.id === matriculaId);
  if (!matricula) return;
  matricula.status = 'active';
  enviarMatricula(`/matriculas/${matriculaId}/restaurar`, { method: 'POST' });
}

/**
 * Descarta o que o navegador guardou e volta ao acervo de demonstração. Com a API
 * ligada, recarrega do servidor: o acervo de demonstração lá é refeito pelo seed.
 */
export function reiniciarComOsMocks(): void {
  if (apiLigada) {
    void carregarTurmasDoServidor();
    return;
  }
  const zerado = apartirDosMocks();
  turmasNoNavegador.splice(0, turmasNoNavegador.length, ...zerado.turmas);
  matriculasNoNavegador.splice(0, matriculasNoNavegador.length, ...zerado.matriculas);
}
