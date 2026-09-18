<script setup lang="ts">
/**
 * Acervo de provas — a seção de referência da linguagem nova.
 *
 * O painel esquerdo concentra ação principal, busca e recorte por situação; a
 * contagem vive colada em cada recorte, no lugar dos antigos cartões de métrica.
 * O conteúdo é uma lista de cartões, não uma tabela: aqui a linha *é* o objeto que
 * se abre, e não um registro que se compara coluna a coluna.
 *
 * Por isso o cartão inteiro é um único alvo: clicar em qualquer parte dele abre o
 * editor. Não há menu de ações na linha — as ações da prova pertencem ao editor, que
 * é onde há contexto para decidir sobre ela.
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronRight, CircleDashed, FileText, LayoutGrid, Plus, Search } from '@lucide/vue';
import { versoesMock } from '@sgp/mocks';
import type { Prova, StatusAplicacao, StatusProva } from '@sgp/shared-types';
import PainelDaSecao from '@/components/casca/PainelDaSecao.vue';
import ItemDeRecorte from '@/components/casca/ItemDeRecorte.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatarData,
  formatarPontos,
  normalizar,
  statusDaProva,
  varianteDoStatusDaProva,
} from '@/lib/dominio';
import { criarProva, listarProvas } from '@/lib/estado-de-provas';
import { listarAplicacoesDaProva } from '@/lib/estado-de-aplicacoes';
import { encontrarTurma } from '@/lib/estado-de-turmas';

interface AplicacaoNaTela {
  id: string;
  turma: string;
  disciplina: string;
  status: StatusAplicacao;
  versoes: number;
}

interface ProvaNaTela extends Prova {
  totalDePontos: number;
  aplicacoes: AplicacaoNaTela[];
}

const roteador = useRouter();
const carregando = ref(true);
const busca = ref('');
const recorte = ref<StatusProva | 'todas'>('todas');
const ordem = ref<'recentes' | 'titulo'>('recentes');

function montar(prova: Prova): ProvaNaTela {
  const aplicacoes = listarAplicacoesDaProva(prova.id).map((aplicacao) => {
    const turma = encontrarTurma(aplicacao.classId);
    return {
      id: aplicacao.id,
      turma: turma?.name ?? 'Turma indisponível',
      disciplina: turma?.subject ?? '',
      status: aplicacao.status,
      versoes: versoesMock.filter((versao) => versao.applicationId === aplicacao.id).length,
    };
  });

  return {
    ...prova,
    totalDePontos: prova.questions.reduce((total, questao) => total + questao.score, 0),
    aplicacoes,
  };
}

const provas = computed<ProvaNaTela[]>(() => listarProvas().map(montar));

onMounted(() => {
  window.setTimeout(() => {
    carregando.value = false;
  }, 350);
});

/** Contagem por recorte: é ela que substitui os cartões de métrica. */
const totalPorStatus = computed<Record<StatusProva | 'todas', number>>(() => ({
  todas: provas.value.length,
  draft: provas.value.filter((prova) => prova.status === 'draft').length,
  ready: provas.value.filter((prova) => prova.status === 'ready').length,
  closed: provas.value.filter((prova) => prova.status === 'closed').length,
}));

const aplicacoesRegistradas = computed(() =>
  provas.value.reduce((total, prova) => total + prova.aplicacoes.length, 0),
);

const provasFiltradas = computed(() => {
  const termo = normalizar(busca.value.trim());
  const lista = provas.value.filter((prova) => {
    const correspondeABusca =
      termo === '' ||
      normalizar(prova.title).includes(termo) ||
      normalizar(prova.description ?? '').includes(termo);
    const correspondeAoRecorte = recorte.value === 'todas' || prova.status === recorte.value;
    return correspondeABusca && correspondeAoRecorte;
  });

  return [...lista].sort((a, b) =>
    ordem.value === 'titulo'
      ? (a.title || 'Prova sem título').localeCompare(b.title || 'Prova sem título', 'pt-BR')
      : b.createdAt.localeCompare(a.createdAt),
  );
});

const temFiltros = computed(() => busca.value.trim() !== '' || recorte.value !== 'todas');

function limparFiltros(): void {
  busca.value = '';
  recorte.value = 'todas';
}

async function criarRascunho(): Promise<void> {
  const prova = criarProva({ title: '' });
  await roteador.push(`/provas/${prova.id}`);
}

/**
 * Grade única para o cabeçalho de colunas e para as linhas, para as duas ficarem
 * alinhadas sem números mágicos repetidos em dois lugares.
 */
const GRADE =
  'grid grid-cols-[2.5rem_minmax(0,1fr)_1.25rem] items-center gap-4 ' +
  'lg:grid-cols-[2.5rem_minmax(0,1fr)_6rem_6.5rem_5rem_6.5rem_7.5rem_1.25rem]';

const recortes = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'draft', rotulo: statusDaProva.draft.rotulo },
  { valor: 'ready', rotulo: statusDaProva.ready.rotulo },
  { valor: 'closed', rotulo: statusDaProva.closed.rotulo },
] as const;
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
    <PainelDaSecao>
      <template #acao>
        <Button class="w-full" @click="criarRascunho">
          <Plus aria-hidden="true" />
          Nova prova
        </Button>
      </template>

      <template #busca>
        <div class="relative">
          <Search
            class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            v-model="busca"
            class="border-none bg-transparent pl-9 shadow-none focus-visible:ring-0 dark:bg-transparent"
            name="busca-prova"
            autocomplete="off"
            placeholder="Buscar…"
            aria-label="Buscar por título ou descrição"
          />
        </div>
      </template>

      <p
        class="px-2.5 pb-1 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground"
      >
        Espaço de trabalho
      </p>
      <div
        class="mb-3 flex h-8 items-center gap-2 rounded-lg bg-background px-2.5 text-sm font-medium"
      >
        <LayoutGrid class="size-3.5 text-muted-foreground" aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate">Meu espaço</span>
        <span class="text-xs tabular-nums text-muted-foreground">{{ totalPorStatus.todas }}</span>
      </div>

      <p
        class="px-2.5 pb-1 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground"
      >
        Situação
      </p>
      <ItemDeRecorte
        v-for="item in recortes"
        :key="item.valor"
        :rotulo="item.rotulo"
        :total="totalPorStatus[item.valor]"
        :ativo="recorte === item.valor"
        @selecionar="recorte = item.valor"
      />

      <template #rodape>
        <p class="flex items-center justify-between px-2.5 text-xs text-muted-foreground">
          <span>Aplicações registradas</span>
          <span class="tabular-nums">{{ aplicacoesRegistradas }}</span>
        </p>
      </template>
    </PainelDaSecao>

    <div class="flex min-w-0 flex-1 flex-col bg-field">
      <div class="flex flex-wrap items-center gap-3 px-5 pb-6 pt-7 sm:px-8 sm:pt-8">
        <div class="mr-auto min-w-0">
          <h1 class="text-[1.375rem] font-medium leading-tight">Meu espaço</h1>
          <p class="mt-1 text-sm text-muted-foreground">Provas criadas e em preparação.</p>
        </div>

        <Select v-model="ordem">
          <SelectTrigger size="sm" class="w-44" aria-label="Ordenar o acervo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recentes">Mais recentes</SelectItem>
            <SelectItem value="titulo">Título (A–Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-if="carregando" class="flex flex-col gap-2 px-5 pb-6 sm:px-8" role="status">
        <span class="sr-only">Carregando provas…</span>
        <div
          v-for="item in 3"
          :key="item"
          class="flex items-center gap-4 rounded-xl border bg-card px-4 py-3"
        >
          <Skeleton class="size-10 rounded-lg" />
          <div class="flex-1 space-y-2">
            <Skeleton class="h-4 w-1/2" />
            <Skeleton class="h-3 w-1/4" />
          </div>
          <Skeleton class="h-6 w-20 rounded-4xl" />
        </div>
      </div>

      <div
        v-else-if="provasFiltradas.length === 0"
        class="mx-5 mb-6 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card px-6 py-20 text-center sm:mx-8"
      >
        <CircleDashed class="size-7 text-muted-foreground" aria-hidden="true" />
        <div>
          <p class="font-medium">Nenhuma prova encontrada</p>
          <p class="mt-1 text-sm text-muted-foreground">
            {{
              temFiltros
                ? 'Revise a busca ou remova os filtros.'
                : 'Crie a primeira prova do acervo.'
            }}
          </p>
        </div>
        <Button v-if="temFiltros" variant="outline" size="sm" @click="limparFiltros">
          Limpar filtros
        </Button>
        <Button v-else size="sm" @click="criarRascunho">
          <Plus aria-hidden="true" />
          Nova prova
        </Button>
      </div>

      <template v-else>
        <div class="px-5 pb-6 sm:px-8">
          <!-- Rótulos soltos sobre os cartões, como na área de workspace da referência. -->
          <div :class="GRADE" class="px-4 pb-2 text-xs font-normal text-muted-foreground">
            <span aria-hidden="true" />
            <span>Prova</span>
            <span class="hidden text-right lg:block">Situação</span>
            <span class="hidden text-right lg:block">Questões</span>
            <span class="hidden text-right lg:block">Pontos</span>
            <span class="hidden text-right lg:block">Aplicações</span>
            <span class="hidden text-right lg:block">Criada em</span>
            <span class="hidden lg:block" aria-hidden="true" />
          </div>

          <ul class="flex flex-col gap-2">
            <li
              v-for="prova in provasFiltradas"
              :key="prova.id"
              :class="GRADE"
              class="group relative rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent/40 focus-within:bg-accent/40"
            >
              <span
                class="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"
              >
                <FileText class="size-5" aria-hidden="true" />
              </span>

              <div class="min-w-0">
                <RouterLink
                  :to="`/provas/${prova.id}`"
                  class="font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
                >
                  {{ prova.title || 'Prova sem título' }}
                </RouterLink>
                <p class="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                  {{ prova.description || 'Sem descrição' }}
                </p>
              </div>

              <div class="hidden justify-end lg:flex">
                <Badge :variant="varianteDoStatusDaProva(prova.status)">
                  {{ statusDaProva[prova.status].rotulo }}
                </Badge>
              </div>

              <span class="hidden text-right text-sm tabular-nums text-muted-foreground lg:block">
                {{ prova.questions.length }}
              </span>
              <span class="hidden text-right text-sm tabular-nums text-muted-foreground lg:block">
                {{ formatarPontos(prova.totalDePontos) }}
              </span>
              <span class="hidden text-right text-sm tabular-nums text-muted-foreground lg:block">
                {{
                  prova.aplicacoes.length
                    ? `${prova.aplicacoes.length} ${prova.aplicacoes.length === 1 ? 'turma' : 'turmas'}`
                    : '—'
                }}
              </span>
              <span
                class="hidden whitespace-nowrap text-right text-sm text-muted-foreground lg:block"
              >
                {{ formatarData(prova.createdAt) }}
              </span>

              <ChevronRight
                class="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </li>
          </ul>
        </div>
      </template>
    </div>
  </div>
</template>
