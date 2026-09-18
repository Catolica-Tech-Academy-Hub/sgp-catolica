<script setup lang="ts">
/**
 * Histórico de notas do estudante (RF11) — a única área que o aluno tem.
 *
 * É somente leitura por definição: o aluno consulta as próprias notas e não escreve
 * nada. Por isso a tela não tem ação principal, e a casca do estudante não tem abas.
 *
 * O "isolamento total" que RF11 exige é regra de backend: aqui o aluno logado é sempre
 * `estudanteLogadoMock`, e as notas exibidas são as dele. Não há como trocar de aluno
 * pela interface, o que mantém a demonstração honesta sem simular autorização.
 *
 * O detalhamento por questão só aparece quando o gabarito daquela versão foi publicado
 * (RF07). Essa condição não é um detalhe de layout: mostrar acerto e erro antes da
 * publicação entregaria o gabarito de uma prova que outra turma ainda vai fazer.
 */
import { computed, onMounted, ref } from 'vue';
import { ChevronRight, GraduationCap, Lock } from '@lucide/vue';
import {
  estudanteLogadoMock,
  correcoesMock,
  notasDoEstudanteMock,
  provasMock,
  questoesMock,
  versoesMock,
} from '@sgp/mocks';
import type { NotaDoEstudante } from '@sgp/shared-types';
import BarrasHorizontais from '@/components/grafico/BarrasHorizontais.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatarData, formatarPontos } from '@/lib/dominio';
import { listarAplicacoes } from '@/lib/estado-de-aplicacoes';
import { encontrarTurma } from '@/lib/estado-de-turmas';

interface QuestaoDoDetalhamento {
  questionId: string;
  ordem: number;
  enunciado: string;
  tipo: 'objetiva' | 'discursiva';
  pontuacaoObtida: number;
  pontuacaoMaxima: number;
  /** Só para objetiva: discursiva tem nota parcial, não acerto e erro. */
  acertou?: boolean;
}

interface NotaNaTela {
  nota: NotaDoEstudante;
  periodo: string;
  detalhamento: QuestaoDoDetalhamento[];
}

const carregando = ref(true);
const disciplinaEscolhida = ref('todas');
const periodoEscolhido = ref('todos');
const detalheAberto = ref(false);
const notaSelecionada = ref<NotaNaTela | null>(null);

onMounted(() => {
  window.setTimeout(() => {
    carregando.value = false;
  }, 350);
});

/**
 * Monta o detalhamento de uma nota a partir da correção do aluno naquela aplicação.
 *
 * A ordem é a **ordem impressa** daquela versão, não a ordem de cadastro da prova: é a
 * sequência que o aluno viu na folha, e é assim que ele vai reconhecer cada questão.
 */
function detalharNota(nota: NotaDoEstudante): QuestaoDoDetalhamento[] {
  const aplicacao = listarAplicacoes().find((item) => item.id === nota.applicationId);
  const versoesDaAplicacao = versoesMock.filter((versao) => versao.applicationId === aplicacao?.id);

  const correcao = correcoesMock.find(
    (item) =>
      item.studentId === estudanteLogadoMock.id &&
      versoesDaAplicacao.some((versao) => versao.id === item.examVersionId),
  );
  const versao = versoesDaAplicacao.find((item) => item.id === correcao?.examVersionId);
  if (!correcao || !versao) return [];

  // `flatMap` descarta a questão sem correção devolvendo lista vazia, sem precisar de
  // um `filter` com predicado de tipo depois.
  return versao.layout.questionOrder.flatMap<QuestaoDoDetalhamento>((questionId, indice) => {
    const questao = questoesMock.find((item) => item.id === questionId);
    const objetiva = correcao.objectiveResults.find((item) => item.questionId === questionId);
    const discursiva = correcao.discursiveScores.find((item) => item.questionId === questionId);
    if (!questao || (!objetiva && !discursiva)) return [];

    return [
      {
        questionId,
        ordem: indice + 1,
        enunciado: questao.statement,
        tipo: questao.type,
        pontuacaoObtida: objetiva?.score ?? discursiva?.score ?? 0,
        pontuacaoMaxima: pontuacaoNaProva(nota.applicationId, questionId),
        acertou: objetiva?.correct,
      },
    ];
  });
}

/**
 * Teto da questão **naquela prova**: a mesma questão vale diferente em provas
 * diferentes (RF04), então a pontuação vem da prova, nunca do banco de questões.
 *
 * A prova é lida dos mocks, e não do estado local do professor: o histórico descreve o
 * que o aluno fez, não o acervo que o professor está editando agora.
 */
function pontuacaoNaProva(applicationId: string, questionId: string): number {
  const aplicacao = listarAplicacoes().find((item) => item.id === applicationId);
  const prova = provasMock.find((item) => item.id === aplicacao?.examId);
  return prova?.questions.find((item) => item.questionId === questionId)?.score ?? 0;
}

const notas = computed<NotaNaTela[]>(() =>
  notasDoEstudanteMock
    .map((nota) => {
      const aplicacao = listarAplicacoes().find((item) => item.id === nota.applicationId);
      const turma = aplicacao ? encontrarTurma(aplicacao.classId) : undefined;
      return {
        nota,
        periodo: turma?.term ?? '',
        detalhamento: detalharNota(nota),
      };
    })
    .sort((a, b) => b.nota.date.localeCompare(a.nota.date)),
);

const disciplinas = computed(() => [...new Set(notas.value.map((item) => item.nota.subject))]);
const periodos = computed(() => [...new Set(notas.value.map((item) => item.periodo))]);

const notasFiltradas = computed(() =>
  notas.value.filter(
    (item) =>
      (disciplinaEscolhida.value === 'todas' || item.nota.subject === disciplinaEscolhida.value) &&
      (periodoEscolhido.value === 'todos' || item.periodo === periodoEscolhido.value),
  ),
);

const temFiltros = computed(
  () => disciplinaEscolhida.value !== 'todas' || periodoEscolhido.value !== 'todos',
);

function limparFiltros(): void {
  disciplinaEscolhida.value = 'todas';
  periodoEscolhido.value = 'todos';
}

/** Evolução: da prova mais antiga para a mais recente, que é como se lê uma trajetória. */
const barrasDaEvolucao = computed(() =>
  [...notasFiltradas.value]
    .sort((a, b) => a.nota.date.localeCompare(b.nota.date))
    .map((item) => ({ rotulo: formatarData(item.nota.date), valor: item.nota.totalScore })),
);

const tetoDasNotas = computed(() =>
  Math.max(1, ...notasFiltradas.value.map((item) => item.nota.maxScore)),
);

const media = computed(() => {
  if (notasFiltradas.value.length === 0) return 0;
  const soma = notasFiltradas.value.reduce((total, item) => total + item.nota.totalScore, 0);
  return soma / notasFiltradas.value.length;
});

const primeiroNome = computed(() => estudanteLogadoMock.fullName.split(' ')[0]);

function abrirDetalhe(item: NotaNaTela): void {
  notaSelecionada.value = item;
  detalheAberto.value = true;
}
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <div class="flex flex-wrap items-end gap-3 px-5 pb-6 pt-7 sm:px-8 sm:pt-8">
      <div class="mr-auto min-w-0">
        <h1 class="text-[1.375rem] font-medium leading-tight">Olá, {{ primeiroNome }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Suas notas nas provas já corrigidas e devolvidas.
        </p>
      </div>

      <Select v-model="disciplinaEscolhida">
        <SelectTrigger size="sm" class="w-full sm:w-52" aria-label="Filtrar por disciplina">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as disciplinas</SelectItem>
          <SelectItem v-for="item in disciplinas" :key="item" :value="item">{{ item }}</SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="periodoEscolhido">
        <SelectTrigger size="sm" class="w-full sm:w-36" aria-label="Filtrar por período">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os períodos</SelectItem>
          <SelectItem v-for="item in periodos" :key="item" :value="item">{{ item }}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div v-if="carregando" class="flex flex-col gap-3 px-5 pb-6 sm:px-8" role="status">
      <span class="sr-only">Carregando suas notas…</span>
      <Skeleton class="h-40 rounded-xl" />
      <Skeleton v-for="item in 3" :key="item" class="h-20 rounded-xl" />
    </div>

    <div
      v-else-if="notas.length === 0"
      class="mx-5 mb-6 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card px-6 py-20 text-center sm:mx-8"
    >
      <GraduationCap class="size-7 text-muted-foreground" aria-hidden="true" />
      <div>
        <p class="font-medium">Você ainda não tem notas</p>
        <p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          As notas aparecem aqui depois que o professor corrige a prova e devolve o resultado.
        </p>
      </div>
    </div>

    <div
      v-else-if="notasFiltradas.length === 0"
      class="mx-5 mb-6 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card px-6 py-20 text-center sm:mx-8"
    >
      <GraduationCap class="size-7 text-muted-foreground" aria-hidden="true" />
      <div>
        <p class="font-medium">Nenhuma nota neste recorte</p>
        <p class="mt-1 text-sm text-muted-foreground">Revise os filtros de disciplina e período.</p>
      </div>
      <Button v-if="temFiltros" variant="outline" size="sm" @click="limparFiltros">
        Limpar filtros
      </Button>
    </div>

    <div v-else class="flex flex-col gap-3 px-5 pb-6 sm:px-8">
      <Card>
        <CardHeader class="flex-row items-center justify-between gap-3">
          <CardTitle class="text-sm font-medium">Evolução das notas</CardTitle>
          <p class="text-xs text-muted-foreground">
            Média
            <span class="font-medium tabular-nums text-foreground">
              {{ formatarPontos(media) }}
            </span>
            em {{ notasFiltradas.length }}
            {{ notasFiltradas.length === 1 ? 'prova' : 'provas' }}
          </p>
        </CardHeader>
        <CardContent>
          <BarrasHorizontais
            :itens="barrasDaEvolucao"
            :maximo="tetoDasNotas"
            :casas-decimais="1"
            titulo="Nota de cada prova, da mais antiga para a mais recente"
          />
        </CardContent>
      </Card>

      <ul class="flex flex-col gap-2">
        <li v-for="item in notasFiltradas" :key="item.nota.applicationId">
          <button
            type="button"
            class="group flex w-full items-center gap-4 rounded-xl border bg-card px-4 py-3 text-left transition-colors outline-none hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            @click="abrirDetalhe(item)"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{{ item.nota.examTitle }}</span>
              <span class="mt-0.5 block truncate text-sm text-muted-foreground">
                {{ item.nota.className }} · {{ item.nota.teacherName }} ·
                {{ formatarData(item.nota.date) }}
              </span>
            </span>

            <Badge v-if="!item.nota.answerKeyPublished" variant="outline" class="hidden sm:flex">
              <Lock aria-hidden="true" />
              Gabarito não publicado
            </Badge>

            <span class="shrink-0 text-right tabular-nums">
              <span class="text-lg font-medium">{{ formatarPontos(item.nota.totalScore) }}</span>
              <span class="text-sm text-muted-foreground">
                / {{ formatarPontos(item.nota.maxScore) }}
              </span>
            </span>

            <ChevronRight
              class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </li>
      </ul>
    </div>

    <Dialog v-model:open="detalheAberto">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ notaSelecionada?.nota.examTitle }}</DialogTitle>
          <DialogDescription>
            <template v-if="notaSelecionada">
              {{ notaSelecionada.nota.className }} · {{ notaSelecionada.nota.teacherName }} ·
              {{ formatarData(notaSelecionada.nota.date) }}
            </template>
          </DialogDescription>
        </DialogHeader>

        <div v-if="notaSelecionada" class="flex flex-col gap-3">
          <div class="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2">
            <span class="text-sm">Nota final</span>
            <span class="tabular-nums">
              <span class="text-base font-medium">
                {{ formatarPontos(notaSelecionada.nota.totalScore) }}
              </span>
              <span class="text-sm text-muted-foreground">
                / {{ formatarPontos(notaSelecionada.nota.maxScore) }}
              </span>
            </span>
          </div>

          <!-- RF11/RF07: sem gabarito publicado, não há detalhamento por questão. -->
          <Alert v-if="!notaSelecionada.nota.answerKeyPublished">
            <Lock aria-hidden="true" />
            <AlertTitle>Gabarito ainda não publicado</AlertTitle>
            <AlertDescription>
              O acerto por questão aparece aqui quando o professor publicar o gabarito desta prova.
              A nota final acima já é a definitiva.
            </AlertDescription>
          </Alert>

          <ul v-else class="scrollbar-sutil flex max-h-80 flex-col gap-2 overflow-y-auto">
            <li
              v-for="questao in notaSelecionada.detalhamento"
              :key="questao.questionId"
              class="rounded-lg border px-3 py-2.5"
            >
              <div class="flex items-start gap-3">
                <span class="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                  {{ questao.ordem }}
                </span>

                <div class="min-w-0 flex-1">
                  <p class="line-clamp-2 text-sm">{{ questao.enunciado }}</p>
                  <div class="mt-1.5 flex items-center gap-2">
                    <Badge
                      v-if="questao.tipo === 'objetiva'"
                      :variant="questao.acertou ? 'default' : 'outline'"
                    >
                      {{ questao.acertou ? 'Acertou' : 'Errou' }}
                    </Badge>
                    <Badge v-else variant="secondary">Discursiva</Badge>
                  </div>
                </div>

                <span class="shrink-0 text-right text-sm tabular-nums">
                  <span class="font-medium">{{ formatarPontos(questao.pontuacaoObtida) }}</span>
                  <span class="text-muted-foreground">
                    / {{ formatarPontos(questao.pontuacaoMaxima) }}
                  </span>
                </span>
              </div>
            </li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
