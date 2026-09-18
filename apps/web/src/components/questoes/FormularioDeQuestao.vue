<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Alternativa, Questao, TipoQuestao } from '@sgp/shared-types';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import CamposDeAlternativas from './CamposDeAlternativas.vue';
import CampoDeTags from './CampoDeTags.vue';

const props = defineProps<{
  aberto: boolean;
  questao?: Questao;
}>();

const emit = defineEmits<{
  'update:aberto': [valor: boolean];
  salvar: [questao: Questao];
  excluir: [id: string];
}>();

function alternativasIniciais(): Alternativa[] {
  return Array.from({ length: 4 }, (_, indice) => ({
    id: `alt-${Date.now()}-${indice}`,
    text: '',
  }));
}

function estadoInicial(): Questao {
  if (props.questao) {
    return JSON.parse(JSON.stringify(props.questao)) as Questao;
  }

  return {
    id: `questao-local-${Date.now()}`,
    teacherId: 'prof-1',
    type: 'objetiva',
    statement: '',
    tags: [],
    alternatives: alternativasIniciais(),
  };
}

const rascunho = ref<Questao>(estadoInicial());

watch(
  () => props.aberto,
  (aberto) => {
    if (aberto) {
      rascunho.value = estadoInicial();
    }
  },
);

const ehEdicao = computed(() => Boolean(props.questao));

function trocarTipo(tipo: TipoQuestao): void {
  if (tipo === rascunho.value.type) return;

  rascunho.value =
    tipo === 'objetiva'
      ? {
          ...rascunho.value,
          type: 'objetiva',
          alternatives: alternativasIniciais(),
          correctAlternativeId: undefined,
          maxScore: undefined,
        }
      : {
          ...rascunho.value,
          type: 'discursiva',
          alternatives: undefined,
          correctAlternativeId: undefined,
          maxScore: rascunho.value.maxScore ?? 1,
        };
}

const podeSalvar = computed(() => {
  if (!rascunho.value.statement.trim()) return false;

  if (rascunho.value.type === 'objetiva') {
    return Boolean(
      rascunho.value.correctAlternativeId &&
      rascunho.value.alternatives &&
      rascunho.value.alternatives.length >= 2 &&
      rascunho.value.alternatives.every((alternativa) => alternativa.text.trim()),
    );
  }

  return typeof rascunho.value.maxScore === 'number' && rascunho.value.maxScore > 0;
});

function salvar(): void {
  if (!podeSalvar.value) return;

  emit('salvar', JSON.parse(JSON.stringify(rascunho.value)) as Questao);

  emit('update:aberto', false);
}
</script>

<template>
  <Dialog :open="aberto" @update:open="emit('update:aberto', $event)">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {{ ehEdicao ? 'Editar questão' : 'Nova questão' }}
        </DialogTitle>

        <DialogDescription>
          {{
            ehEdicao
              ? 'Altere o conteúdo desta questão do banco.'
              : 'Crie uma questão reutilizável para suas provas.'
          }}
        </DialogDescription>
      </DialogHeader>

      <div class="scrollbar-sutil flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1">
        <div class="flex flex-col gap-1.5">
          <Label for="tipo-questao">Tipo</Label>

          <Select
            :model-value="rascunho.type"
            @update:model-value="trocarTipo($event as TipoQuestao)"
          >
            <SelectTrigger id="tipo-questao" class="w-full">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="objetiva"> Objetiva </SelectItem>

              <SelectItem value="discursiva"> Discursiva </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="enunciado-questao"> Enunciado </Label>

          <Textarea
            id="enunciado-questao"
            class="min-h-24"
            placeholder="Escreva o enunciado da questão…"
            :model-value="rascunho.statement"
            @update:model-value="rascunho.statement = String($event)"
          />
        </div>

        <CamposDeAlternativas
          v-if="rascunho.type === 'objetiva'"
          :alternativas="rascunho.alternatives ?? []"
          :correta-id="rascunho.correctAlternativeId"
          nome-do-grupo="gabarito-formulario-questao"
          @update:alternativas="rascunho.alternatives = $event"
          @update:correta-id="rascunho.correctAlternativeId = $event"
        />

        <div v-else class="flex flex-col gap-1.5">
          <Label for="pontuacao-maxima"> Pontuação máxima </Label>

          <Input
            id="pontuacao-maxima"
            type="number"
            min="0.5"
            step="0.5"
            name="pontuacaoMaxima"
            autocomplete="off"
            :model-value="rascunho.maxScore ?? 1"
            @update:model-value="rascunho.maxScore = Number($event) || 0"
          />
        </div>

        <CampoDeTags
          id="tags-questao"
          :model-value="rascunho.tags"
          @update:model-value="rascunho.tags = $event"
        />
      </div>

      <DialogFooter>
        <Button
          v-if="ehEdicao"
          variant="destructive"
          class="sm:mr-auto"
          @click="emit('excluir', rascunho.id)"
        >
          Excluir questão
        </Button>

        <Button variant="outline" @click="emit('update:aberto', false)"> Cancelar </Button>

        <Button :disabled="!podeSalvar" @click="salvar"> Salvar </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
