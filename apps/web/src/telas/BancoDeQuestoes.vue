<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { CircleDashed, Plus, Search } from '@lucide/vue';
import { toast } from 'vue-sonner';
import type { Questao, TipoQuestao } from '@sgp/shared-types';

import PainelDaSecao from '@/components/casca/PainelDaSecao.vue';
import ItemDeRecorte from '@/components/casca/ItemDeRecorte.vue';
import CartaoDeQuestao from '@/components/questoes/CartaoDeQuestao.vue';
import FormularioDeQuestao from '@/components/questoes/FormularioDeQuestao.vue';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { normalizar } from '@/lib/dominio';

import {
  excluirQuestaoDoBanco,
  listarQuestoesDoBanco,
  restaurarQuestaoDoBanco,
  salvarQuestaoNoBanco,
} from '@/lib/estado-de-questoes';

const carregando = ref(true);
const busca = ref('');
const recorte = ref<TipoQuestao | 'todas'>('todas');
const formularioAberto = ref(false);
const questaoEmEdicao = ref<Questao | undefined>(undefined);

onMounted(() => {
  window.setTimeout(() => {
    carregando.value = false;
  }, 350);
});

const questoesAtivas = computed<Questao[]>(() =>
  listarQuestoesDoBanco().filter((questao) => !questao.deletedAt),
);

const totalPorTipo = computed<Record<TipoQuestao | 'todas', number>>(() => ({
  todas: questoesAtivas.value.length,

  objetiva: questoesAtivas.value.filter((questao) => questao.type === 'objetiva').length,

  discursiva: questoesAtivas.value.filter((questao) => questao.type === 'discursiva').length,
}));

const questoesFiltradas = computed(() => {
  const termo = normalizar(busca.value.trim());

  return questoesAtivas.value.filter((questao) => {
    const correspondeABusca =
      termo === '' ||
      normalizar(questao.statement).includes(termo) ||
      questao.tags.some((tag) => normalizar(tag).includes(termo));

    const correspondeAoRecorte = recorte.value === 'todas' || questao.type === recorte.value;

    return correspondeABusca && correspondeAoRecorte;
  });
});

function limparFiltros(): void {
  busca.value = '';
  recorte.value = 'todas';
}

function abrirCriacao(): void {
  questaoEmEdicao.value = undefined;
  formularioAberto.value = true;
}

function abrirEdicao(questao: Questao): void {
  questaoEmEdicao.value = questao;
  formularioAberto.value = true;
}

function aoSalvar(questao: Questao): void {
  const resultado = salvarQuestaoNoBanco(questao);

  toast.success(resultado === 'criada' ? 'Questão criada' : 'Questão atualizada');
}

function excluir(id: string): void {
  excluirQuestaoDoBanco(id);

  toast.error('Questão excluída', {
    description: 'A questão foi removida do banco. Você pode desfazer.',
    action: {
      label: 'Desfazer',
      onClick: () => {
        restaurarQuestaoDoBanco(id);
        toast.success('Questão restaurada');
      },
    },
  });
}

const recortes: Array<{
  valor: TipoQuestao | 'todas';
  rotulo: string;
}> = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'objetiva', rotulo: 'Objetivas' },
  { valor: 'discursiva', rotulo: 'Discursivas' },
];
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
    <PainelDaSecao>
      <template #acao>
        <Button class="w-full" @click="abrirCriacao">
          <Plus aria-hidden="true" />
          Nova questão
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
            name="busca-questao"
            autocomplete="off"
            placeholder="Buscar por enunciado ou tag…"
            aria-label="Buscar por enunciado ou tag"
          />
        </div>
      </template>

      <p
        class="px-2.5 pb-1 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground"
      >
        Tipo
      </p>

      <ItemDeRecorte
        v-for="item in recortes"
        :key="item.valor"
        :rotulo="item.rotulo"
        :total="totalPorTipo[item.valor]"
        :ativo="recorte === item.valor"
        @selecionar="recorte = item.valor"
      />

      <template #rodape>
        <p class="flex items-center justify-between px-2.5 text-xs text-muted-foreground">
          <span>Questões no banco</span>

          <span class="tabular-nums">
            {{ totalPorTipo.todas }}
          </span>
        </p>
      </template>
    </PainelDaSecao>

    <div class="flex min-w-0 flex-1 flex-col bg-field">
      <div class="px-5 pb-6 pt-7 sm:px-8 sm:pt-8">
        <h1 class="text-[1.375rem] font-medium leading-tight">Banco de questões</h1>

        <p class="mt-1 text-sm text-muted-foreground">Questões reutilizáveis em qualquer prova.</p>
      </div>

      <div v-if="carregando" class="flex flex-col gap-2 px-5 pb-6 sm:px-8" role="status">
        <span class="sr-only"> Carregando questões… </span>

        <div
          v-for="item in 3"
          :key="item"
          class="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3"
        >
          <Skeleton class="h-5 w-24 rounded-4xl" />
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-4 w-2/3" />
        </div>
      </div>

      <div
        v-else-if="questoesAtivas.length === 0"
        class="mx-5 mb-6 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card px-6 py-20 text-center sm:mx-8"
      >
        <CircleDashed class="size-7 text-muted-foreground" aria-hidden="true" />

        <div>
          <p class="font-medium">O banco de questões está vazio</p>

          <p class="mt-1 text-sm text-muted-foreground">
            Crie a primeira questão para reutilizar em suas provas.
          </p>
        </div>

        <Button size="sm" @click="abrirCriacao">
          <Plus aria-hidden="true" />
          Nova questão
        </Button>
      </div>

      <div
        v-else-if="questoesFiltradas.length === 0"
        class="mx-5 mb-6 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card px-6 py-20 text-center sm:mx-8"
      >
        <CircleDashed class="size-7 text-muted-foreground" aria-hidden="true" />

        <div>
          <p class="font-medium">Nenhuma questão encontrada</p>

          <p class="mt-1 text-sm text-muted-foreground">Revise a busca ou remova os filtros.</p>
        </div>

        <Button variant="outline" size="sm" @click="limparFiltros"> Limpar filtros </Button>
      </div>

      <ul v-else class="flex flex-col gap-2 px-5 pb-6 sm:px-8">
        <CartaoDeQuestao
          v-for="questao in questoesFiltradas"
          :key="questao.id"
          :questao="questao"
          @selecionar="abrirEdicao(questao)"
        />
      </ul>
    </div>

    <FormularioDeQuestao
      v-model:aberto="formularioAberto"
      :questao="questaoEmEdicao"
      @salvar="aoSalvar"
      @excluir="
        (id) => {
          formularioAberto = false;
          excluir(id);
        }
      "
    />
  </div>
</template>
