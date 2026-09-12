<script setup lang="ts">
import { ref } from 'vue';
import { X } from '@lucide/vue';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

const props = defineProps<{
  modelValue: string[];
  id?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [tags: string[]];
}>();

const rascunho = ref('');

function adicionar(): void {
  const valor = rascunho.value.trim();
  rascunho.value = '';

  if (!valor || props.modelValue.includes(valor)) return;

  emit('update:modelValue', [...props.modelValue, valor]);
}

function remover(tag: string): void {
  emit(
    'update:modelValue',
    props.modelValue.filter((item) => item !== tag),
  );
}

function aoDigitar(evento: KeyboardEvent): void {
  if (evento.key === 'Enter' || evento.key === ',') {
    evento.preventDefault();
    adicionar();
  }
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <Label :for="id">Tags</Label>

    <div
      class="dark:bg-input/30 border-input focus-within:border-ring focus-within:ring-ring/40 flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border bg-transparent px-2.5 py-1.5 transition-colors focus-within:ring-3"
    >
      <Badge v-for="tag in modelValue" :key="tag" variant="secondary" class="gap-1">
        {{ tag }}

        <button
          type="button"
          class="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :aria-label="`Remover tag ${tag}`"
          @click="remover(tag)"
        >
          <X class="size-3" aria-hidden="true" />
        </button>
      </Badge>

      <input
        :id="id"
        v-model="rascunho"
        type="text"
        class="min-w-24 flex-1 border-none bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground"
        placeholder="Adicionar tag e pressionar Enter"
        @keydown="aoDigitar"
        @blur="adicionar"
      />
    </div>
  </div>
</template>
