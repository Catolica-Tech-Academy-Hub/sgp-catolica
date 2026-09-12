<script setup lang="ts">
/**
 * Navegação principal dentro da moldura cinza. A borda inferior separa a escolha
 * de seção do espaço de trabalho, sem introduzir uma segunda barra de cor.
 */
import { useRoute } from 'vue-router';
import {
  ChartNoAxesCombined,
  ClipboardCheck,
  ClipboardList,
  Files,
  ScanLine,
  UsersRound,
} from '@lucide/vue';

const secoes = [
  { rotulo: 'Provas', para: '/provas', icone: Files },
  { rotulo: 'Aplicações', para: '/aplicacoes', icone: ClipboardCheck },
  { rotulo: 'Banco de questões', para: '/banco-de-questoes', icone: ClipboardList },
  { rotulo: 'Turmas', para: '/turmas', icone: UsersRound },
  { rotulo: 'Correções', para: '/correcoes', icone: ScanLine },
  { rotulo: 'Relatórios', para: '/relatorios', icone: ChartNoAxesCombined },
];

const rota = useRoute();

function ativa(caminho: string): boolean {
  return rota.path === caminho || rota.path.startsWith(`${caminho}/`);
}
</script>

<template>
  <nav
    aria-label="Seções do produto"
    class="abas-de-secao flex h-12 shrink-0 items-center gap-1 overflow-x-auto overflow-y-hidden border-b bg-field px-3 sm:px-4"
  >
    <RouterLink
      v-for="secao in secoes"
      :key="secao.para"
      :to="secao.para"
      :aria-current="ativa(secao.para) ? 'page' : undefined"
      class="relative flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition-colors outline-none after:absolute after:-bottom-2 after:left-3 after:right-3 after:h-0.5 after:rounded-full focus-visible:ring-3 focus-visible:ring-ring/40"
      :class="
        ativa(secao.para)
          ? 'bg-background font-medium text-foreground after:bg-primary'
          : 'font-normal text-muted-foreground after:bg-transparent hover:bg-background/60 hover:text-foreground'
      "
    >
      <component :is="secao.icone" class="size-4" aria-hidden="true" />
      {{ secao.rotulo }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.abas-de-secao {
  scrollbar-width: none;
}

.abas-de-secao::-webkit-scrollbar {
  display: none;
}
</style>
