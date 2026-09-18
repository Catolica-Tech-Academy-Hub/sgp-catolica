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
 */
import { computed, onMounted, ref } from 'vue';
import { GraduationCap } from '@lucide/vue';
import { estudanteLogadoMock, notasDoEstudanteMock } from '@sgp/mocks';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const carregando = ref(true);

onMounted(() => {
  window.setTimeout(() => {
    carregando.value = false;
  }, 350);
});

const notas = computed(() => notasDoEstudanteMock);

const primeiroNome = computed(() => estudanteLogadoMock.fullName.split(' ')[0]);
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <div class="px-5 pb-6 pt-7 sm:px-8 sm:pt-8">
      <h1 class="text-[1.375rem] font-medium leading-tight">Olá, {{ primeiroNome }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Suas notas nas provas já corrigidas e devolvidas.
      </p>
    </div>

    <div v-if="carregando" class="flex flex-col gap-2 px-5 pb-6 sm:px-8" role="status">
      <span class="sr-only">Carregando suas notas…</span>
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

    <div v-else class="px-5 pb-6 sm:px-8">
      <Card>
        <CardContent class="py-4">
          <p class="text-sm text-muted-foreground">
            {{ notas.length }}
            {{ notas.length === 1 ? 'prova realizada' : 'provas realizadas' }}.
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
