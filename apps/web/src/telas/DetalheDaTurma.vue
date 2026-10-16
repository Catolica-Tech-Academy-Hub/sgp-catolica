<script setup lang="ts">
/**
 * Detalhe da turma — cabeçalho com identificação e ações (editar, arquivar), código
 * de convite com regeneração e a lista de alunos matriculados.
 *
 * Diferente do editor de prova, esta tela não é um modo de tela cheia: fica dentro da
 * casca autenticada, com a aba "Turmas" ativa dando contexto, por isso não usa
 * breadcrumb (ver design system web).
 *
 * Alunos matriculados são comparados por coluna (nome, e-mail, matrícula, data), por
 * isso usam `Table` em `Card`, não lista de cartões — ver a régua "Escolher lista ou
 * tabela" do design system.
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, Archive, KeyRound, Pencil, RefreshCw, UserMinus, Users } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatarData, statusDaTurma, varianteDoStatusDaTurma } from '@/lib/dominio';
import {
  arquivarTurma,
  atualizarTurma,
  encontrarEstudante,
  encontrarTurma,
  listarMatriculasDaTurma,
  regenerarCodigoDeConvite,
  removerMatricula,
  restaurarMatricula,
} from '@/lib/estado-de-turmas';

const rota = useRoute();
const carregando = ref(true);
const turma = ref(encontrarTurma(rota.params.id as string) ?? null);

onMounted(() => {
  window.setTimeout(() => {
    carregando.value = false;
  }, 350);
});

interface AlunoNaTela {
  matricula: ReturnType<typeof listarMatriculasDaTurma>[number];
  estudante: NonNullable<ReturnType<typeof encontrarEstudante>>;
}

const alunosMatriculados = computed<AlunoNaTela[]>(() => {
  if (!turma.value) return [];
  const itens: AlunoNaTela[] = [];
  for (const matricula of listarMatriculasDaTurma(turma.value.id)) {
    const estudante = encontrarEstudante(matricula.studentId);
    if (estudante) itens.push({ matricula, estudante });
  }
  return itens;
});

// --- Edição de nome, disciplina e período -------------------------------------

const edicaoAberta = ref(false);
const campoNome = ref('');
const campoDisciplina = ref('');
const campoPeriodo = ref('');
const erroDeEdicao = ref('');

function abrirEdicao(): void {
  if (!turma.value) return;
  campoNome.value = turma.value.name;
  campoDisciplina.value = turma.value.subject;
  campoPeriodo.value = turma.value.term;
  erroDeEdicao.value = '';
  edicaoAberta.value = true;
}

function salvarEdicao(): void {
  if (!turma.value) return;
  if (!campoNome.value.trim() || !campoDisciplina.value.trim() || !campoPeriodo.value.trim()) {
    erroDeEdicao.value = 'Preencha nome, disciplina e período.';
    return;
  }
  atualizarTurma(turma.value.id, {
    name: campoNome.value.trim(),
    subject: campoDisciplina.value.trim(),
    term: campoPeriodo.value.trim(),
  });
  edicaoAberta.value = false;
  toast.success('Turma atualizada');
}

// --- Arquivar -------------------------------------------------------------------

function arquivar(): void {
  if (!turma.value) return;
  arquivarTurma(turma.value.id);
  toast.success('Turma arquivada', {
    description: 'As aplicações existentes continuam valendo.',
  });
}

// --- Código de convite ------------------------------------------------------------

async function regenerarCodigo(): Promise<void> {
  if (!turma.value) return;
  try {
    const novoCodigo = await regenerarCodigoDeConvite(turma.value.id);
    if (novoCodigo) {
      toast.success('Código de convite regenerado', {
        description: 'O código anterior foi invalidado.',
      });
    }
  } catch {
    toast.error('Não foi possível regenerar o código', {
      description: 'O código atual continua valendo.',
    });
  }
}

// --- Remoção de matrícula, reversível por toast ------------------------------------

function removerAluno(matriculaId: string, nomeDoAluno: string): void {
  removerMatricula(matriculaId);
  toast(`${nomeDoAluno} removido da turma`, {
    description: 'O histórico de notas foi preservado.',
    action: {
      label: 'Desfazer',
      onClick: () => restaurarMatricula(matriculaId),
    },
  });
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-field">
    <div v-if="carregando" class="flex flex-col gap-4 px-5 py-7 sm:px-8">
      <span class="sr-only" role="status">Carregando a turma…</span>
      <Skeleton class="h-4 w-24" />
      <Skeleton class="h-8 w-72" />
      <Skeleton class="h-32 w-full max-w-2xl" />
      <Skeleton class="h-64 w-full" />
    </div>

    <div
      v-else-if="!turma"
      class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <h1 class="text-xl font-semibold">Turma não encontrada</h1>
      <p class="max-w-sm text-sm text-muted-foreground">
        Ela pode ter sido removida ou o endereço está incorreto.
      </p>
      <Button as-child variant="outline">
        <RouterLink to="/turmas">Voltar para Turmas</RouterLink>
      </Button>
    </div>

    <template v-else>
      <div class="flex flex-col gap-6 px-5 py-7 sm:px-8">
        <Button as-child variant="ghost" size="sm" class="w-fit -ml-2">
          <RouterLink to="/turmas">
            <ArrowLeft aria-hidden="true" />
            Turmas
          </RouterLink>
        </Button>

        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-[1.375rem] font-medium leading-tight">
                {{ turma.name || 'Turma sem nome' }}
              </h1>
              <Badge :variant="varianteDoStatusDaTurma(turma.status)">
                {{ statusDaTurma[turma.status].rotulo }}
              </Badge>
            </div>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ turma.subject || 'Sem disciplina' }} · {{ turma.term || 'Sem período' }}
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" @click="abrirEdicao">
              <Pencil aria-hidden="true" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              :disabled="turma.status === 'archived'"
              @click="arquivar"
            >
              <Archive aria-hidden="true" />
              Arquivar
            </Button>
          </div>
        </div>

        <Card class="w-full max-w-2xl">
          <CardContent class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"
              >
                <KeyRound class="size-5" aria-hidden="true" />
              </span>
              <div>
                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Código de convite
                </p>
                <p class="font-mono text-base font-medium">{{ turma.inviteCode }}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" @click="regenerarCodigo">
              <RefreshCw aria-hidden="true" />
              Regenerar
            </Button>
          </CardContent>
        </Card>

        <div>
          <div class="mb-3 flex items-center gap-2">
            <Users class="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 class="text-sm font-medium">
              Alunos matriculados
              <span class="tabular-nums text-muted-foreground"
                >({{ alunosMatriculados.length }})</span
              >
            </h2>
          </div>

          <Card class="min-w-0 overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Matriculado em</TableHead>
                  <TableHead class="text-right">
                    <span class="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableEmpty v-if="alunosMatriculados.length === 0" :colspan="5">
                  <div class="text-center">
                    <p class="font-medium">Nenhum aluno matriculado</p>
                    <p class="mt-1 text-sm text-muted-foreground">
                      Alunos entram usando o código de convite acima.
                    </p>
                  </div>
                </TableEmpty>
                <TableRow v-for="item in alunosMatriculados" :key="item.matricula.id">
                  <TableCell class="font-medium">{{ item.estudante.fullName }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ item.estudante.email }}</TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ item.estudante.registration ?? '—' }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ formatarData(item.matricula.enrolledAt) }}
                  </TableCell>
                  <TableCell class="text-right">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          :aria-label="`Remover ${item.estudante.fullName} da turma`"
                          @click="removerAluno(item.matricula.id, item.estudante.fullName)"
                        >
                          <UserMinus aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remover da turma</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>

      <Dialog v-model:open="edicaoAberta">
        <DialogContent class="sm:max-w-md">
          <form novalidate @submit.prevent="salvarEdicao">
            <DialogHeader>
              <DialogTitle>Editar turma</DialogTitle>
              <DialogDescription>Nome, disciplina e período da turma.</DialogDescription>
            </DialogHeader>

            <div class="space-y-4 py-2">
              <div class="space-y-2">
                <Label for="turma-nome">Nome</Label>
                <Input
                  id="turma-nome"
                  v-model="campoNome"
                  name="nome"
                  autocomplete="off"
                  :aria-invalid="erroDeEdicao && !campoNome.trim() ? true : undefined"
                />
              </div>

              <div class="space-y-2">
                <Label for="turma-disciplina">Disciplina</Label>
                <Input
                  id="turma-disciplina"
                  v-model="campoDisciplina"
                  name="disciplina"
                  autocomplete="off"
                  :aria-invalid="erroDeEdicao && !campoDisciplina.trim() ? true : undefined"
                />
              </div>

              <div class="space-y-2">
                <Label for="turma-periodo">Período</Label>
                <Input
                  id="turma-periodo"
                  v-model="campoPeriodo"
                  name="periodo"
                  autocomplete="off"
                  placeholder="Ex.: 2026/1"
                  :aria-invalid="erroDeEdicao && !campoPeriodo.trim() ? true : undefined"
                />
              </div>

              <p v-if="erroDeEdicao" class="text-sm text-destructive" role="alert">
                {{ erroDeEdicao }}
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" @click="edicaoAberta = false">
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
