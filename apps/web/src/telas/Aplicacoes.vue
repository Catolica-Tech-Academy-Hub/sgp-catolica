<script setup lang="ts">
/** Lista e detalhe somente leitura das aplicações de provas em turmas. */
import { computed, onMounted, ref } from 'vue';
import { CircleDashed, ClipboardCheck, Search } from '@lucide/vue';
import { versoesMock } from '@sgp/mocks';
import type { Aplicacao, StatusAplicacao, Turma } from '@sgp/shared-types';
import PainelDaSecao from '@/components/casca/PainelDaSecao.vue';
import ItemDeRecorte from '@/components/casca/ItemDeRecorte.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  formatarData,
  normalizar,
  statusDaAplicacao,
  varianteDoStatusDaAplicacao,
} from '@/lib/dominio';
import { listarAplicacoes } from '@/lib/estado-de-aplicacoes';
import { encontrarTurma } from '@/lib/estado-de-turmas';
import { listarProvas } from '@/lib/estado-de-provas';

interface AplicacaoNaTela {
  aplicacao: Aplicacao;
  prova: ReturnType<typeof listarProvas>[number] | undefined;
  turma: Turma | undefined;
  versoes: ReturnType<typeof versoesMock.filter>;
}

const carregando = ref(true);
const busca = ref('');
const recorte = ref<StatusAplicacao | 'todas'>('todas');
const detalheAberto = ref(false);
const aplicacaoSelecionada = ref<AplicacaoNaTela | null>(null);

const aplicacoes = computed<AplicacaoNaTela[]>(() =>
  listarAplicacoes().map((aplicacao) => ({
    aplicacao,
    prova: listarProvas().find((prova) => prova.id === aplicacao.examId),
    turma: encontrarTurma(aplicacao.classId),
    versoes: versoesMock.filter((versao) => versao.applicationId === aplicacao.id),
  })),
);

const aplicacoesFiltradas = computed(() => {
  const termo = normalizar(busca.value.trim());
  return aplicacoes.value.filter((item) => {
    const correspondeABusca =
      termo === '' ||
      normalizar(item.prova?.title ?? '').includes(termo) ||
      normalizar(item.turma?.name ?? '').includes(termo);
    const correspondeAoRecorte =
      recorte.value === 'todas' || item.aplicacao.status === recorte.value;
    return correspondeABusca && correspondeAoRecorte;
  });
});

const totalPorStatus = computed<Record<StatusAplicacao | 'todas', number>>(() => ({
  todas: aplicacoes.value.length,
  draft: aplicacoes.value.filter((item) => item.aplicacao.status === 'draft').length,
  generated: aplicacoes.value.filter((item) => item.aplicacao.status === 'generated').length,
  closed: aplicacoes.value.filter((item) => item.aplicacao.status === 'closed').length,
}));

const temFiltros = computed(() => busca.value.trim() !== '' || recorte.value !== 'todas');

const recortes = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'draft', rotulo: statusDaAplicacao.draft.rotulo },
  { valor: 'generated', rotulo: statusDaAplicacao.generated.rotulo },
] as const;

onMounted(() => {
  window.setTimeout(() => {
    carregando.value = false;
  }, 350);
});

function abrirDetalhe(item: AplicacaoNaTela): void {
  aplicacaoSelecionada.value = item;
  detalheAberto.value = true;
}

function limparFiltros(): void {
  busca.value = '';
  recorte.value = 'todas';
}

function nomeDaProva(item: AplicacaoNaTela): string {
  return item.prova?.title || 'Prova indisponível';
}
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
            name="busca-aplicacao"
            autocomplete="off"
            placeholder="Buscar…"
            aria-label="Buscar por prova ou turma"
          />
        </div>
      </template>

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
          <span>Aplicações no espaço</span>
          <span class="tabular-nums">{{ totalPorStatus.todas }}</span>
        </p>
      </template>
    </PainelDaSecao>

    <div class="flex min-w-0 flex-1 flex-col bg-field">
      <div class="px-5 pb-6 pt-7 sm:px-8 sm:pt-8">
        <h1 class="text-[1.375rem] font-medium leading-tight">Aplicações</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Provas combinadas com turmas. A geração de PDF acontece em uma etapa futura.
        </p>
      </div>

      <div v-if="carregando" class="flex flex-col gap-2 px-5 pb-6 sm:px-8" role="status">
        <span class="sr-only">Carregando aplicações…</span>
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
        v-else-if="aplicacoesFiltradas.length === 0"
        class="mx-5 mb-6 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card px-6 py-20 text-center sm:mx-8"
      >
        <CircleDashed class="size-7 text-muted-foreground" aria-hidden="true" />
        <div>
          <p class="font-medium">Nenhuma aplicação encontrada</p>
          <p class="mt-1 text-sm text-muted-foreground">
            {{
              temFiltros
                ? 'Revise a busca ou remova os filtros.'
                : 'Aplique uma prova a uma turma pelo editor.'
            }}
          </p>
        </div>
        <Button v-if="temFiltros" variant="outline" size="sm" @click="limparFiltros">
          Limpar filtros
        </Button>
      </div>

      <ul v-else class="flex flex-col gap-2 px-5 pb-6 sm:px-8">
        <li v-for="item in aplicacoesFiltradas" :key="item.aplicacao.id">
          <button
            type="button"
            class="group flex w-full items-center gap-4 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            @click="abrirDetalhe(item)"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"
            >
              <ClipboardCheck class="size-5" aria-hidden="true" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{{ nomeDaProva(item) }}</span>
              <span class="mt-0.5 block truncate text-sm text-muted-foreground">
                {{ item.turma?.name ?? 'Turma indisponível' }} · {{ item.turma?.subject ?? '—' }}
              </span>
            </span>
            <span class="hidden text-right text-sm text-muted-foreground sm:block">
              {{ item.versoes.length }} {{ item.versoes.length === 1 ? 'versão' : 'versões' }}
            </span>
            <Badge :variant="varianteDoStatusDaAplicacao(item.aplicacao.status)">
              {{ statusDaAplicacao[item.aplicacao.status].rotulo }}
            </Badge>
            <span class="hidden text-right text-sm text-muted-foreground lg:block">
              {{ formatarData(item.aplicacao.createdAt) }}
            </span>
          </button>
        </li>
      </ul>
    </div>

    <Dialog v-model:open="detalheAberto">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{
            aplicacaoSelecionada ? nomeDaProva(aplicacaoSelecionada) : ''
          }}</DialogTitle>
          <DialogDescription>
            {{ aplicacaoSelecionada?.turma?.name ?? 'Turma indisponível' }} · versões existentes
          </DialogDescription>
        </DialogHeader>

        <div v-if="aplicacaoSelecionada" class="space-y-3 py-2">
          <div
            class="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-sm"
          >
            <span>Status</span>
            <Badge :variant="varianteDoStatusDaAplicacao(aplicacaoSelecionada.aplicacao.status)">
              {{ statusDaAplicacao[aplicacaoSelecionada.aplicacao.status].rotulo }}
            </Badge>
          </div>
          <div v-if="aplicacaoSelecionada.versoes.length" class="space-y-2">
            <div
              v-for="versao in aplicacaoSelecionada.versoes"
              :key="versao.id"
              class="rounded-lg border px-3 py-3 text-sm"
            >
              <div class="flex items-center justify-between gap-3">
                <span class="font-medium">Versão {{ versao.versionNumber }}</span>
                <span class="text-muted-foreground">{{ formatarData(versao.createdAt) }}</span>
              </div>
              <p class="mt-2 text-muted-foreground">
                Questões {{ versao.shuffleQuestions ? 'embaralhadas' : 'na ordem da prova' }} ·
                alternativas {{ versao.shuffleAlternatives ? 'embaralhadas' : 'na ordem da prova' }}
              </p>
              <p class="mt-1 text-muted-foreground">
                Gabarito {{ versao.answerKeyPublished ? 'publicado' : 'não publicado' }} · código
                {{ versao.publicCode }}
              </p>
            </div>
          </div>
          <p v-else class="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
            Nenhuma versão foi gerada para esta aplicação.
          </p>
        </div>

        <DialogFooter>
          <Tooltip>
            <TooltipTrigger as-child>
              <span tabindex="-1">
                <Button type="button" disabled>Gerar PDF</Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>A geração de PDF pertence à próxima fase (RF06).</TooltipContent>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
