<script setup lang="ts">
import type { Questao } from '@sgp/shared-types';
import { Badge } from '@/components/ui/badge';

defineProps<{ questao: Questao }>();

defineEmits<{
  selecionar: [];
}>();
</script>

<template>
  <li>
    <button
      type="button"
      class="flex w-full flex-col gap-2 rounded-xl border bg-card px-4 py-3 text-left transition-colors outline-none hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50"
      @click="$emit('selecionar')"
    >
      <div class="flex items-center gap-2">
        <Badge variant="outline">
          {{ questao.type === 'objetiva' ? 'Objetiva' : 'Discursiva' }}
        </Badge>

        <span v-if="questao.type === 'objetiva'" class="text-xs text-muted-foreground">
          {{ questao.alternatives?.length ?? 0 }} alternativas
        </span>
      </div>

      <p class="line-clamp-2 text-sm">
        {{ questao.statement || 'Questão sem enunciado' }}
      </p>

      <div v-if="questao.tags.length" class="flex flex-wrap gap-1.5">
        <Badge v-for="tag in questao.tags" :key="tag" variant="secondary">
          {{ tag }}
        </Badge>
      </div>
    </button>
  </li>
</template>
