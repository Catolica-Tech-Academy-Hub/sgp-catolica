<script setup lang="ts">
import { Plus, Trash2 } from '@lucide/vue';
import type { Alternativa } from '@sgp/shared-types';
import { Button } from '@/components/ui/button';

const props = defineProps<{
  alternativas: Alternativa[];
  corretaId?: string;
  nomeDoGrupo: string;
}>();

const emit = defineEmits<{
  'update:alternativas': [alternativas: Alternativa[]];
  'update:corretaId': [id: string | undefined];
}>();

const letras = ['A', 'B', 'C', 'D', 'E'];

function atualizarTexto(id: string, texto: string): void {
  emit(
    'update:alternativas',
    props.alternativas.map((alternativa) =>
      alternativa.id === id ? { ...alternativa, text: texto } : alternativa,
    ),
  );
}

function adicionar(): void {
  if (props.alternativas.length >= 5) return;

  emit('update:alternativas', [...props.alternativas, { id: `alt-${Date.now()}`, text: '' }]);
}

function remover(id: string): void {
  if (props.alternativas.length <= 2) return;

  emit(
    'update:alternativas',
    props.alternativas.filter((alternativa) => alternativa.id !== id),
  );

  if (props.corretaId === id) {
    emit('update:corretaId', undefined);
  }
}
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-1 text-sm font-medium">Alternativas</legend>

    <div
      v-for="(alternativa, indice) in alternativas"
      :key="alternativa.id"
      class="group/alternativa flex items-center gap-2"
    >
      <input
        type="radio"
        :name="nomeDoGrupo"
        :checked="corretaId === alternativa.id"
        :aria-label="`Marcar alternativa ${letras[indice]} como correta`"
        class="size-4 shrink-0 accent-current"
        @change="emit('update:corretaId', alternativa.id)"
      />

      <span class="w-5 shrink-0 text-sm font-medium text-muted-foreground">
        {{ letras[indice] }})
      </span>

      <input
        class="dark:bg-input/30 border-input focus-visible:ring-ring/40 min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3"
        :value="alternativa.text"
        :aria-label="`Texto da alternativa ${letras[indice]}`"
        placeholder="Escreva a alternativa"
        @input="atualizarTexto(alternativa.id, ($event.target as HTMLInputElement).value)"
      />

      <Button
        v-if="alternativas.length > 2"
        variant="ghost"
        size="icon-xs"
        class="opacity-0 group-focus-within/alternativa:opacity-100 group-hover/alternativa:opacity-100"
        :aria-label="`Remover alternativa ${letras[indice]}`"
        @click="remover(alternativa.id)"
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </div>

    <Button
      v-if="alternativas.length < 5"
      variant="ghost"
      size="sm"
      class="mt-1 self-start"
      @click="adicionar"
    >
      <Plus aria-hidden="true" />
      Adicionar alternativa
    </Button>
  </fieldset>
</template>
