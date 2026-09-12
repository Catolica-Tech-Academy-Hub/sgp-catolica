<script setup lang="ts">
/**
 * Barra do editor.
 *
 * Substitui a casca da aplicação enquanto a prova está aberta. Segue a referência:
 * barra **clara** com breadcrumb à esquerda — `Provas › nome da prova` —, e não uma
 * faixa escura. O breadcrumb existe aqui porque aqui há hierarquia de verdade: uma
 * prova vive dentro do acervo. Nas telas de seção ele não existe, porque a aba ativa
 * já diz onde você está.
 *
 * O título é editado no lugar e o contador mostra o limite de RF04 em vez de
 * escondê-lo.
 */
import { computed } from 'vue';
import { ChevronRight, Eye, Files } from '@lucide/vue';
import type { StatusProva } from '@sgp/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatarPontos, statusDaProva, varianteDoStatusDaProva } from '@/lib/dominio';
import { MAXIMO_DE_QUESTOES } from '@/lib/blocos-da-prova';

const props = defineProps<{
  titulo: string;
  status: StatusProva;
  totalDeQuestoes: number;
  totalDePontos: number;
}>();

defineEmits<{
  'update:titulo': [valor: string];
  visualizar: [];
  aplicar: [];
}>();

const noLimite = computed(() => props.totalDeQuestoes >= MAXIMO_DE_QUESTOES);
</script>

<template>
  <header class="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 sm:px-4">
    <nav aria-label="Trilha de navegação" class="flex min-w-0 items-center gap-1.5">
      <RouterLink
        to="/provas"
        class="flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Files class="size-4" aria-hidden="true" />
        Provas
      </RouterLink>
      <ChevronRight class="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />

      <Label for="titulo-prova" class="sr-only">Título da prova</Label>
      <Input
        id="titulo-prova"
        :model-value="titulo"
        class="h-8 min-w-0 max-w-80 border-none bg-transparent px-1.5 text-sm font-medium shadow-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-1 dark:bg-transparent"
        placeholder="Prova sem título"
        autocomplete="off"
        @update:model-value="$emit('update:titulo', String($event))"
      />
    </nav>

    <Badge :variant="varianteDoStatusDaProva(status)" class="hidden shrink-0 sm:inline-flex">
      {{ statusDaProva[status].rotulo }}
    </Badge>

    <div class="ml-auto flex shrink-0 items-center gap-3">
      <Tooltip>
        <TooltipTrigger as-child>
          <p class="hidden text-xs text-muted-foreground lg:block">
            <span :class="noLimite ? 'font-semibold text-foreground' : ''">
              {{ totalDeQuestoes }} de {{ MAXIMO_DE_QUESTOES }} questões
            </span>
            · {{ formatarPontos(totalDePontos) }} pontos · salvo
          </p>
        </TooltipTrigger>
        <TooltipContent>
          Guardado neste navegador, sem servidor. A persistência real chega com o backend.
        </TooltipContent>
      </Tooltip>

      <Button variant="outline" size="sm" @click="$emit('visualizar')">
        <Eye aria-hidden="true" />
        <span class="hidden sm:inline">Pré-visualizar</span>
        <span class="sr-only sm:hidden">Pré-visualizar prova</span>
      </Button>

      <Button size="sm" @click="$emit('aplicar')">Aplicar a uma turma</Button>
    </div>
  </header>
</template>
