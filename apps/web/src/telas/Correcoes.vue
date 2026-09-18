<script setup lang="ts">
/**
 * Fila de atribuição manual de nota (RF09).
 *
 * A leitura de QR Code e de cartão-resposta é exclusiva do aplicativo do professor
 * (RF08) e não tem equivalente aqui. O que pertence à web é o caso da prova gerada
 * **sem identificação**: o aplicativo calcula a nota mas não sabe de quem ela é, e o
 * professor associa cada correção a um aluno a partir do nome e da matrícula que leu
 * na folha.
 *
 * As correções são comparadas coluna a coluna (aluno informado, versão, nota, data),
 * por isso usam `Table` em `Card`, e não lista de cartões — ver a régua "Escolher lista
 * ou tabela" do design system.
 */
import { computed, nextTick, onMounted, ref, useId } from 'vue';
import { CircleDashed, ScanLine, Search, UserRoundCheck } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { estudantesMock, versoesMock } from '@sgp/mocks';
import type { Correcao, Estudante } from '@sgp/shared-types';
import PainelDaSecao from '@/components/casca/PainelDaSecao.vue';
import ItemDeRecorte from '@/components/casca/ItemDeRecorte.vue';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  formatarData,
  formatarDataHora,
  formatarPontos,
  nomeCorresponde,
  normalizar,
} from '@/lib/dominio';
import { listarAplicacoes } from '@/lib/estado-de-aplicacoes';
import {
  alunoJaTemCorrecaoNaVersao,
  atribuirCorrecao,
  desfazerAtribuicao,
  listarCorrecoes,
} from '@/lib/estado-de-correcoes';
import { encontrarProva } from '@/lib/estado-de-provas';
import { encontrarTurma, listarMatriculasDaTurma } from '@/lib/estado-de-turmas';

type Situacao = 'pendentes' | 'atribuidas' | 'todas';

interface CorrecaoNaTela {
  correcao: Correcao;
  aplicacaoId: string;
  tituloDaProva: string;
  nomeDaTurma: string;
  classId: string;
  numeroDaVersao: number;
  totalDaProva: number;
  criadaEm: string;
  aluno: Estudante | undefined;
}

const carregando = ref(true);
const busca = ref('');
const aplicacaoEscolhida = ref('todas');
const situacao = ref<Situacao>('pendentes');

const idDaBuscaDeAluno = useId();

onMounted(() => {
  window.setTimeout(() => {
    carregando.value = false;
  }, 350);
});

/**
 * Resolve, para cada correção, a cadeia versão → aplicação → prova/turma. A correção
 * guarda apenas `examVersionId`; tudo que a tela mostra ao lado dela vem desse caminho.
 */
const correcoes = computed<CorrecaoNaTela[]>(() =>
  listarCorrecoes().map((correcao) => {
    const versao = versoesMock.find((item) => item.id === correcao.examVersionId);
    const aplicacao = listarAplicacoes().find((item) => item.id === versao?.applicationId);
    const prova = aplicacao ? encontrarProva(aplicacao.examId) : undefined;
    const turma = aplicacao ? encontrarTurma(aplicacao.classId) : undefined;

    return {
      correcao,
      aplicacaoId: aplicacao?.id ?? '',
      tituloDaProva: prova?.title || 'Prova indisponível',
      nomeDaTurma: turma?.name || 'Turma indisponível',
      classId: aplicacao?.classId ?? '',
      numeroDaVersao: versao?.versionNumber ?? 0,
      criadaEm: aplicacao?.createdAt ?? correcao.confirmedAt,
      totalDaProva: (prova?.questions ?? []).reduce((total, questao) => total + questao.score, 0),
      aluno: correcao.studentId
        ? estudantesMock.find((estudante) => estudante.id === correcao.studentId)
        : undefined,
    };
  }),
);

/**
 * Só aplicações que produziram alguma correção entram no filtro.
 *
 * O rótulo carrega prova, turma **e** data porque a mesma prova pode ir duas vezes
 * para a mesma turma (segunda chamada, RF05): sem a data, as duas ficariam idênticas
 * na lista. Por isso este filtro é um `Select` no cabeçalho, e não um recorte do painel
 * esquerdo, onde 256 px truncariam o rótulo justamente no que o distingue.
 */
const aplicacoesComCorrecao = computed(() => {
  const vistas = new Map<string, { id: string; rotulo: string }>();
  for (const item of correcoes.value) {
    if (vistas.has(item.aplicacaoId)) continue;
    vistas.set(item.aplicacaoId, {
      id: item.aplicacaoId,
      rotulo: `${item.tituloDaProva} · ${item.nomeDaTurma} · ${formatarData(item.criadaEm)}`,
    });
  }
  return [...vistas.values()];
});

const totalPorSituacao = computed<Record<Situacao, number>>(() => ({
  pendentes: correcoes.value.filter((item) => !item.correcao.studentId).length,
  atribuidas: correcoes.value.filter((item) => item.correcao.studentId).length,
  todas: correcoes.value.length,
}));

function correspondeASituacao(item: CorrecaoNaTela): boolean {
  if (situacao.value === 'pendentes') return !item.correcao.studentId;
  if (situacao.value === 'atribuidas') return Boolean(item.correcao.studentId);
  return true;
}

const correcoesFiltradas = computed(() => {
  const termo = normalizar(busca.value.trim());
  return correcoes.value.filter((item) => {
    const correspondeABusca =
      termo === '' ||
      nomeCorresponde(item.correcao.reportedStudentName ?? '', busca.value) ||
      (item.correcao.reportedStudentRegistration ?? '').includes(termo) ||
      nomeCorresponde(item.aluno?.fullName ?? '', busca.value);
    const correspondeAAplicacao =
      aplicacaoEscolhida.value === 'todas' || item.aplicacaoId === aplicacaoEscolhida.value;
    return correspondeABusca && correspondeAAplicacao && correspondeASituacao(item);
  });
});

const temFiltros = computed(
  () =>
    busca.value.trim() !== '' || aplicacaoEscolhida.value !== 'todas' || situacao.value !== 'todas',
);

function limparFiltros(): void {
  busca.value = '';
  aplicacaoEscolhida.value = 'todas';
  situacao.value = 'todas';
}

// --- Atribuição manual ------------------------------------------------------------

const atribuicaoAberta = ref(false);
const emAtribuicao = ref<CorrecaoNaTela | null>(null);
const buscaDeAluno = ref('');
const alunoEscolhido = ref('');

/**
 * Abre a atribuição já com o nome lido na folha na busca: RF09 pede que o que foi
 * digitado no aplicativo venha pré-preenchido, para o professor não redigitar.
 */
function abrirAtribuicao(item: CorrecaoNaTela): void {
  emAtribuicao.value = item;
  buscaDeAluno.value = item.correcao.reportedStudentName ?? '';
  alunoEscolhido.value = '';
  atribuicaoAberta.value = true;
}

interface CandidatoAAtribuicao {
  estudante: Estudante;
  /** Preenchido quando o aluno não pode receber esta correção; vira o motivo na tela. */
  impedimento?: string;
}

/** Candidatos são os matriculados na turma da aplicação — nunca a base inteira de alunos. */
const candidatos = computed<CandidatoAAtribuicao[]>(() => {
  const item = emAtribuicao.value;
  if (!item) return [];

  const termo = normalizar(buscaDeAluno.value.trim());

  return listarMatriculasDaTurma(item.classId)
    .map((matricula) => estudantesMock.find((estudante) => estudante.id === matricula.studentId))
    .filter((estudante): estudante is Estudante => Boolean(estudante))
    .filter(
      (estudante) =>
        nomeCorresponde(estudante.fullName, buscaDeAluno.value) ||
        (estudante.registration ?? '').includes(termo),
    )
    .map((estudante) => ({
      estudante,
      impedimento: alunoJaTemCorrecaoNaVersao(
        item.correcao.examVersionId,
        estudante.id,
        item.correcao.id,
      )
        ? 'Já tem nota nesta versão'
        : undefined,
    }));
});

const alunoDisponivel = computed(() =>
  candidatos.value.some(
    (candidato) => candidato.estudante.id === alunoEscolhido.value && !candidato.impedimento,
  ),
);

function confirmarAtribuicao(): void {
  const item = emAtribuicao.value;
  if (!item || !alunoDisponivel.value) return;

  const nome =
    candidatos.value.find((candidato) => candidato.estudante.id === alunoEscolhido.value)?.estudante
      .fullName ?? 'Aluno';

  if (!atribuirCorrecao(item.correcao.id, alunoEscolhido.value)) {
    toast.error('Não foi possível atribuir', {
      description: `${nome} já tem uma nota registrada nesta versão da prova.`,
    });
    return;
  }

  const correcaoId = item.correcao.id;
  atribuicaoAberta.value = false;
  toast.success(`Nota atribuída a ${nome}`, {
    description: 'A nota passa a aparecer no histórico do aluno.',
    action: {
      label: 'Desfazer',
      onClick: () => {
        desfazerAtribuicao(correcaoId);
        toast.info('Atribuição desfeita', {
          description: 'A correção voltou para a fila de pendentes.',
        });
      },
    },
  });
}

/** O campo de busca é o primeiro passo da atribuição, então recebe o foco na abertura. */
async function focarBuscaDeAluno(): Promise<void> {
  await nextTick();
  document.getElementById(idDaBuscaDeAluno)?.focus();
}

const situacoes = [
  { valor: 'pendentes', rotulo: 'Pendentes' },
  { valor: 'atribuidas', rotulo: 'Atribuídas' },
  { valor: 'todas', rotulo: 'Todas' },
] as const;
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
    <PainelDaSecao>
      <template #busca>
        <div class="relative">
          <Search
            class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            v-model="busca"
            class="border-none bg-transparent pl-9 shadow-none focus-visible:ring-0 dark:bg-transparent"
            name="busca-correcao"
            autocomplete="off"
            placeholder="Buscar…"
            aria-label="Buscar por nome ou matrícula informados na folha"
          />
        </div>
      </template>

      <p
        class="px-2.5 pb-1 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground"
      >
        Situação
      </p>
      <ItemDeRecorte
        v-for="item in situacoes"
        :key="item.valor"
        :rotulo="item.rotulo"
        :total="totalPorSituacao[item.valor]"
        :ativo="situacao === item.valor"
        @selecionar="situacao = item.valor"
      />

      <template #rodape>
        <p class="flex items-center justify-between px-2.5 text-xs text-muted-foreground">
          <span>Pendentes de atribuição</span>
          <span class="tabular-nums">{{ totalPorSituacao.pendentes }}</span>
        </p>
      </template>
    </PainelDaSecao>

    <div class="flex min-w-0 flex-1 flex-col bg-field">
      <div class="flex flex-wrap items-center gap-3 px-5 pb-6 pt-7 sm:px-8 sm:pt-8">
        <div class="mr-auto min-w-0">
          <h1 class="text-[1.375rem] font-medium leading-tight">Correções</h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Notas calculadas no aplicativo que aguardam um aluno (RF09).
          </p>
        </div>

        <Select v-model="aplicacaoEscolhida">
          <SelectTrigger size="sm" class="w-full sm:w-80" aria-label="Filtrar por aplicação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as aplicações</SelectItem>
            <SelectItem
              v-for="aplicacao in aplicacoesComCorrecao"
              :key="aplicacao.id"
              :value="aplicacao.id"
            >
              {{ aplicacao.rotulo }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-if="carregando" class="px-5 pb-6 sm:px-8" role="status">
        <span class="sr-only">Carregando correções…</span>
        <Card>
          <CardContent class="flex flex-col gap-4 py-5">
            <Skeleton v-for="item in 4" :key="item" class="h-8 w-full" />
          </CardContent>
        </Card>
      </div>

      <div
        v-else-if="correcoes.length === 0"
        class="mx-5 mb-6 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card px-6 py-20 text-center sm:mx-8"
      >
        <ScanLine class="size-7 text-muted-foreground" aria-hidden="true" />
        <div>
          <p class="font-medium">Nenhuma correção recebida</p>
          <p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            As correções chegam do aplicativo do professor, depois da leitura do cartão-resposta
            (RF08).
          </p>
        </div>
      </div>

      <div v-else class="px-5 pb-6 sm:px-8">
        <Card>
          <CardContent class="p-0">
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno informado</TableHead>
                    <TableHead>Prova e turma</TableHead>
                    <TableHead class="text-right">Versão</TableHead>
                    <TableHead class="text-right">Nota</TableHead>
                    <TableHead class="text-right">Corrigida em</TableHead>
                    <TableHead class="text-right">Situação</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  <TableEmpty v-if="correcoesFiltradas.length === 0" :colspan="6">
                    <div class="flex flex-col items-center gap-3 text-center">
                      <CircleDashed class="size-7 text-muted-foreground" aria-hidden="true" />
                      <div>
                        <p class="font-medium">Nenhuma correção nesta fatia</p>
                        <p class="mt-1 text-sm text-muted-foreground">
                          {{
                            situacao === 'pendentes' && !temFiltros
                              ? 'Toda correção recebida já foi atribuída a um aluno.'
                              : 'Revise a busca ou remova os filtros.'
                          }}
                        </p>
                      </div>
                      <Button v-if="temFiltros" variant="outline" size="sm" @click="limparFiltros">
                        Limpar filtros
                      </Button>
                    </div>
                  </TableEmpty>

                  <TableRow v-for="item in correcoesFiltradas" :key="item.correcao.id">
                    <TableCell>
                      <span class="block font-medium">
                        {{
                          item.aluno?.fullName ??
                          item.correcao.reportedStudentName ??
                          'Sem identificação na folha'
                        }}
                      </span>
                      <span class="mt-0.5 block text-xs text-muted-foreground">
                        {{
                          item.aluno?.registration ??
                          item.correcao.reportedStudentRegistration ??
                          'Matrícula não informada'
                        }}
                      </span>
                    </TableCell>

                    <TableCell class="text-muted-foreground">
                      <span class="block">{{ item.tituloDaProva }}</span>
                      <span class="mt-0.5 block text-xs">{{ item.nomeDaTurma }}</span>
                    </TableCell>

                    <TableCell class="text-right tabular-nums text-muted-foreground">
                      {{ item.numeroDaVersao }}
                    </TableCell>

                    <TableCell class="text-right tabular-nums">
                      <span class="font-medium">{{
                        formatarPontos(item.correcao.totalScore)
                      }}</span>
                      <span class="text-muted-foreground">
                        / {{ formatarPontos(item.totalDaProva) }}
                      </span>
                    </TableCell>

                    <TableCell class="whitespace-nowrap text-right text-muted-foreground">
                      {{ formatarDataHora(item.correcao.confirmedAt) }}
                    </TableCell>

                    <TableCell class="text-right">
                      <Badge v-if="item.correcao.studentId" variant="secondary">
                        <UserRoundCheck aria-hidden="true" />
                        Atribuída
                      </Badge>
                      <Button v-else size="sm" @click="abrirAtribuicao(item)">Atribuir</Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <Dialog v-model:open="atribuicaoAberta" @update:open="$event && focarBuscaDeAluno()">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atribuir nota a um aluno</DialogTitle>
          <DialogDescription>
            <template v-if="emAtribuicao">
              {{ emAtribuicao.tituloDaProva }} · versão {{ emAtribuicao.numeroDaVersao }} · nota
              {{ formatarPontos(emAtribuicao.correcao.totalScore) }} de
              {{ formatarPontos(emAtribuicao.totalDaProva) }}
            </template>
          </DialogDescription>
        </DialogHeader>

        <div v-if="emAtribuicao" class="flex flex-col gap-3 py-1">
          <div class="flex flex-col gap-1.5">
            <Label :for="idDaBuscaDeAluno">
              Aluno matriculado em {{ emAtribuicao.nomeDaTurma }}
            </Label>
            <Input
              :id="idDaBuscaDeAluno"
              v-model="buscaDeAluno"
              name="busca-aluno"
              autocomplete="off"
              placeholder="Buscar por nome ou matrícula"
            />
            <p class="text-xs text-muted-foreground">
              {{
                emAtribuicao.correcao.reportedStudentName
                  ? 'Pré-preenchido com o nome lido na folha.'
                  : 'Nada foi lido na folha: escolha o aluno na lista.'
              }}
            </p>
          </div>

          <fieldset class="scrollbar-sutil flex max-h-64 flex-col gap-1 overflow-y-auto">
            <legend class="sr-only">Alunos matriculados na turma</legend>

            <p
              v-if="candidatos.length === 0"
              class="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground"
            >
              Nenhum aluno matriculado corresponde à busca.
            </p>

            <label
              v-for="candidato in candidatos"
              :key="candidato.estudante.id"
              class="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-3 focus-within:ring-ring/40"
              :class="
                candidato.impedimento
                  ? 'cursor-not-allowed opacity-60'
                  : 'cursor-pointer hover:bg-accent/40'
              "
            >
              <input
                v-model="alunoEscolhido"
                type="radio"
                name="aluno-da-atribuicao"
                class="size-4 shrink-0 accent-current"
                :value="candidato.estudante.id"
                :disabled="Boolean(candidato.impedimento)"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium">{{ candidato.estudante.fullName }}</span>
                <span class="block truncate text-xs text-muted-foreground">
                  {{ candidato.estudante.registration ?? 'Sem matrícula' }}
                </span>
              </span>
              <Badge v-if="candidato.impedimento" variant="outline">
                {{ candidato.impedimento }}
              </Badge>
            </label>
          </fieldset>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="atribuicaoAberta = false">Cancelar</Button>
          <Button :disabled="!alunoDisponivel" @click="confirmarAtribuicao">Atribuir nota</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
