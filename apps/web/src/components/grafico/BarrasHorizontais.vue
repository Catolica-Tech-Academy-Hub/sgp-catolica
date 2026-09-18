<script setup lang="ts">
/**
 * Gráfico de barras horizontais — o formato padrão de gráfico da web (ver design system).
 *
 * Horizontal, e não vertical, porque os rótulos do domínio são textos ("Avaliação 01 -
 * Arquitetura e Requisitos", "8-10"): na vertical eles giram ou truncam, na horizontal
 * eles simplesmente cabem.
 *
 * O valor aparece **em texto** ao lado de cada barra, não só no comprimento dela. A barra
 * ordena a comparação; quem lê com leitor de tela, ou imprime em preto e branco, continua
 * tendo o número. Por isso também não há dependência de biblioteca de gráfico: uma barra
 * é uma div com largura proporcional.
 */
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    itens: { rotulo: string; valor: number }[];
    /** Rótulo da série, usado como nome acessível da lista. */
    titulo: string;
    /**
     * Teto da escala. Sem ele, a maior barra vira 100% e a comparação passa a ser
     * relativa — o que é certo para contagem, e errado para nota (8 de 10 não é "cheio").
     */
    maximo?: number;
    /** Sufixo exibido junto do valor, como "%" ou "pt". */
    unidade?: string;
    /**
     * Casas decimais do valor. Existe para o gráfico e a tabela ao lado dele nunca
     * exibirem o mesmo número de formas diferentes (6,67 contra 6,7).
     */
    casasDecimais?: number;
  }>(),
  { maximo: undefined, unidade: '', casasDecimais: 2 },
);

const teto = computed(() => {
  if (props.maximo !== undefined) return props.maximo;
  return Math.max(1, ...props.itens.map((item) => item.valor));
});

function larguraEmPorcento(valor: number): string {
  return `${Math.min(100, (valor / teto.value) * 100)}%`;
}

// `minimum` junto de `maximum`: com uma casa, 6 sai "6,0" e nao "6", igual ao que
// `formatarPontos` mostra na tabela e nos cartoes ao lado do grafico.
const formatador = computed(
  () =>
    new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: props.casasDecimais,
      maximumFractionDigits: props.casasDecimais,
    }),
);
</script>

<template>
  <ul class="flex flex-col gap-2.5" :aria-label="titulo">
    <li
      v-for="item in itens"
      :key="item.rotulo"
      class="grid grid-cols-[5rem_1fr_3.5rem] gap-3 sm:grid-cols-[11rem_1fr_3.5rem]"
    >
      <span class="truncate text-xs text-muted-foreground" :title="item.rotulo">
        {{ item.rotulo }}
      </span>

      <span class="flex h-5 items-center">
        <span class="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <span
            class="block h-full rounded-full bg-primary transition-[width]"
            :style="{ width: larguraEmPorcento(item.valor) }"
          />
        </span>
      </span>

      <span class="text-right text-xs tabular-nums">
        {{ formatador.format(item.valor) }}{{ unidade }}
      </span>
    </li>
  </ul>
</template>
