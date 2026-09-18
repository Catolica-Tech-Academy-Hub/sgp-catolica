<script setup lang="ts">
/**
 * Ajuda — perguntas frequentes e contato.
 *
 * Não corresponde a nenhum RF: é utilitário de produto. Existe porque "Ajuda" era um
 * botão morto na barra superior, e um botão que não faz nada é pior do que uma tela
 * simples que responde de verdade.
 *
 * O conteúdo vem de `lib/conteudo-de-ajuda.ts`. O formulário de contato fica
 * desabilitado com a explicação, no mesmo padrão de "ação sem backend" de Integrações e
 * da exportação de relatórios.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { CircleDashed, LifeBuoy, Mail, Search } from '@lucide/vue';
import PainelDaSecao from '@/components/casca/PainelDaSecao.vue';
import ItemDeRecorte from '@/components/casca/ItemDeRecorte.vue';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { normalizar } from '@/lib/dominio';
import {
  assuntosDeAjuda,
  canaisDeContato,
  perguntasFrequentes,
  type AssuntoDeAjuda,
} from '@/lib/conteudo-de-ajuda';

const carregando = ref(true);
const busca = ref('');
const assunto = ref<AssuntoDeAjuda | 'todos'>('todos');

onMounted(() => {
  window.setTimeout(() => {
    carregando.value = false;
  }, 250);
});

/** A busca cobre pergunta, resposta e assunto: quem procura "QR Code" não sabe em qual seção ele está. */
const perguntasFiltradas = computed(() => {
  const termo = normalizar(busca.value.trim());

  return perguntasFrequentes.filter((item) => {
    const correspondeABusca =
      termo === '' ||
      normalizar(item.pergunta).includes(termo) ||
      normalizar(item.assunto).includes(termo) ||
      item.resposta.some((paragrafo) => normalizar(paragrafo).includes(termo));
    const correspondeAoAssunto = assunto.value === 'todos' || item.assunto === assunto.value;
    return correspondeABusca && correspondeAoAssunto;
  });
});

const totalPorAssunto = computed<Record<string, number>>(() => {
  const totais: Record<string, number> = { todos: perguntasFrequentes.length };
  for (const item of assuntosDeAjuda) {
    totais[item] = perguntasFrequentes.filter((pergunta) => pergunta.assunto === item).length;
  }
  return totais;
});

const temFiltros = computed(() => busca.value.trim() !== '' || assunto.value !== 'todos');

function limparFiltros(): void {
  busca.value = '';
  assunto.value = 'todos';
}

/**
 * Quais respostas estão abertas.
 *
 * Precisa ser estado, e não `computed`: amarrar `model-value` a um valor derivado deixa
 * o acordeão controlado sem ninguém tratar a atualização, e o clique para de abrir.
 *
 * Buscar abre o que casou — quem procurou uma palavra quer ler a resposta que a contém,
 * não uma lista de títulos fechados para abrir um a um. Limpar a busca fecha tudo de
 * volta, para a lista não ficar num acordeão inteiro expandido.
 */
const abertas = ref<string[]>([]);

watch([busca, perguntasFiltradas], ([termo, filtradas]) => {
  abertas.value = termo.trim() === '' ? [] : filtradas.map((item) => item.id);
});
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
            name="busca-ajuda"
            autocomplete="off"
            placeholder="Buscar na ajuda…"
            aria-label="Buscar nas perguntas frequentes"
          />
        </div>
      </template>

      <p
        class="px-2.5 pb-1 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground"
      >
        Assunto
      </p>
      <ItemDeRecorte
        rotulo="Todos"
        :total="totalPorAssunto.todos"
        :ativo="assunto === 'todos'"
        @selecionar="assunto = 'todos'"
      />
      <ItemDeRecorte
        v-for="item in assuntosDeAjuda"
        :key="item"
        :rotulo="item"
        :total="totalPorAssunto[item]"
        :ativo="assunto === item"
        @selecionar="assunto = item"
      />
    </PainelDaSecao>

    <div class="flex min-w-0 flex-1 flex-col bg-field">
      <div class="px-5 pb-6 pt-7 sm:px-8 sm:pt-8">
        <h1 class="text-[1.375rem] font-medium leading-tight">Ajuda</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Como o sistema funciona e o que ainda não está conectado.
        </p>
      </div>

      <div v-if="carregando" class="flex flex-col gap-2 px-5 pb-6 sm:px-8" role="status">
        <span class="sr-only">Carregando a ajuda…</span>
        <Skeleton v-for="item in 5" :key="item" class="h-11 rounded-lg" />
      </div>

      <div v-else class="flex flex-col gap-4 px-5 pb-6 sm:px-8">
        <Card>
          <CardContent class="py-1">
            <div
              v-if="perguntasFiltradas.length === 0"
              class="flex flex-col items-center gap-3 py-14 text-center"
            >
              <CircleDashed class="size-7 text-muted-foreground" aria-hidden="true" />
              <div>
                <p class="font-medium">Nenhuma resposta para esta busca</p>
                <p class="mt-1 text-sm text-muted-foreground">
                  Tente outra palavra ou fale com o suporte, logo abaixo.
                </p>
              </div>
              <Button v-if="temFiltros" variant="outline" size="sm" @click="limparFiltros">
                Limpar filtros
              </Button>
            </div>

            <Accordion v-else v-model="abertas" type="multiple">
              <AccordionItem v-for="item in perguntasFiltradas" :key="item.id" :value="item.id">
                <AccordionTrigger>{{ item.pergunta }}</AccordionTrigger>
                <AccordionContent>
                  <p
                    v-for="(paragrafo, indice) in item.resposta"
                    :key="indice"
                    class="text-muted-foreground"
                  >
                    {{ paragrafo }}
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <!-- Contato: informação, não envio. Sem backend não existe para onde mandar. -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-sm font-medium">
              <LifeBuoy class="size-4 text-muted-foreground" aria-hidden="true" />
              Falar com o suporte
            </CardTitle>
          </CardHeader>

          <CardContent class="flex flex-col gap-5 lg:flex-row">
            <ul class="flex shrink-0 flex-col gap-3 lg:w-72">
              <li
                v-for="canal in canaisDeContato"
                :key="canal.id"
                class="rounded-lg border bg-background px-3 py-2.5"
              >
                <p class="flex items-center gap-2 text-sm font-medium">
                  <Mail class="size-3.5 text-muted-foreground" aria-hidden="true" />
                  {{ canal.titulo }}
                </p>
                <p class="mt-1 text-xs text-muted-foreground">{{ canal.descricao }}</p>
              </li>
            </ul>

            <form class="flex min-w-0 flex-1 flex-col gap-3" aria-describedby="aviso-do-contato">
              <div class="flex flex-col gap-1.5">
                <Label for="assunto-do-contato">Assunto</Label>
                <Input
                  id="assunto-do-contato"
                  name="assuntoDoContato"
                  autocomplete="off"
                  placeholder="Resumo do que aconteceu"
                  disabled
                />
              </div>

              <div class="flex flex-col gap-1.5">
                <Label for="mensagem-do-contato">Mensagem</Label>
                <Textarea
                  id="mensagem-do-contato"
                  class="min-h-24"
                  name="mensagemDoContato"
                  placeholder="Descreva o problema, a tela em que ele aconteceu e o que você esperava."
                  disabled
                />
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3">
                <p id="aviso-do-contato" class="text-xs text-muted-foreground">
                  O envio depende do backend e entra em uma próxima fase.
                </p>

                <Tooltip>
                  <TooltipTrigger as-child>
                    <span tabindex="-1">
                      <Button type="submit" size="sm" disabled>Enviar mensagem</Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Sem servidor, não há para onde enviar — nada seria entregue.
                  </TooltipContent>
                </Tooltip>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
