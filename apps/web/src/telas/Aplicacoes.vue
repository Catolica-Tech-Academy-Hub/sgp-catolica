<script setup lang="ts">
/** Lista e detalhe somente leitura das aplicações de provas em turmas. */
import { computed, onMounted, ref } from 'vue';
import { CircleDashed, ClipboardCheck, Search } from '@lucide/vue';
import { versoesMock } from '@sgp/mocks';
import type { Aplicacao, StatusAplicacao, Turma } from '@sgp/shared-types';
import { toast } from 'vue-sonner';
import PainelDaSecao from '@/components/casca/PainelDaSecao.vue';
import ItemDeRecorte from '@/components/casca/ItemDeRecorte.vue';
import { Badge } from '@/components/ui/badge';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  formatarData,
  normalizar,
  statusDaAplicacao,
  varianteDoStatusDaAplicacao,
} from '@/lib/dominio';
import {
  listarAplicacoes,
  obterAplicacao,
  baixarPdfDaAplicacao,
  gerarPdfDaAplicacao,
} from '@/lib/estado-de-aplicacoes';
import { apiLigada } from '@/lib/api';
import { encontrarTurma } from '@/lib/estado-de-turmas';
import { listarProvas } from '@/lib/estado-de-provas';
import { obterCabecalhoDaProva } from '@/lib/cabecalhos-da-prova';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface AplicacaoNaTela {
  aplicacao: Aplicacao;
  prova: ReturnType<typeof listarProvas>[number] | undefined;
  turma: Turma | undefined;
  versoes: ReturnType<typeof versoesMock.filter>;
}

const carregando = ref(true);
const busca = ref('');
const recorte = ref<StatusAplicacao | 'todas'>('todas');
const detalheAberto = ref(false);
const aplicacaoSelecionada = ref<AplicacaoNaTela | null>(null);
const geracaoAberta = ref(false);
const quantidadeDeVersoes = ref(1);
const embaralharQuestoes = ref(false);
const embaralharAlternativas = ref(false);
const identificarEstudantes = ref(true);
const gerandoPdf = ref(false);
const baixandoPdf = ref(false);
const quantidadeDeVersoesValida = computed(
  () =>
    Number.isInteger(quantidadeDeVersoes.value) &&
    quantidadeDeVersoes.value >= 1 &&
    quantidadeDeVersoes.value <= 20,
);

const aplicacoes = computed<AplicacaoNaTela[]>(() =>
  listarAplicacoes().map((aplicacao) => ({
    aplicacao,
    prova: listarProvas().find((prova) => prova.id === aplicacao.examId),
    turma: encontrarTurma(aplicacao.classId),
    versoes: apiLigada ? [] : versoesMock.filter((versao) => versao.applicationId === aplicacao.id),
  })),
);

const aplicacoesFiltradas = computed(() => {
  const termo = normalizar(busca.value.trim());
  return aplicacoes.value.filter((item) => {
    const correspondeABusca =
      termo === '' ||
      normalizar(item.prova?.title ?? '').includes(termo) ||
      normalizar(item.turma?.name ?? '').includes(termo);
    const correspondeAoRecorte =
      recorte.value === 'todas' || item.aplicacao.status === recorte.value;
    return correspondeABusca && correspondeAoRecorte;
  });
});

const totalPorStatus = computed<Record<StatusAplicacao | 'todas', number>>(() => ({
  todas: aplicacoes.value.length,
  draft: aplicacoes.value.filter((item) => item.aplicacao.status === 'draft').length,
  generated: aplicacoes.value.filter((item) => item.aplicacao.status === 'generated').length,
  closed: aplicacoes.value.filter((item) => item.aplicacao.status === 'closed').length,
}));

const temFiltros = computed(() => busca.value.trim() !== '' || recorte.value !== 'todas');

const recortes = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'draft', rotulo: statusDaAplicacao.draft.rotulo },
  { valor: 'generated', rotulo: statusDaAplicacao.generated.rotulo },
] as const;

onMounted(() => {
  window.setTimeout(() => {
    carregando.value = false;
  }, 350);
});

async function abrirDetalhe(item: AplicacaoNaTela): Promise<void> {
  aplicacaoSelecionada.value = item;
  detalheAberto.value = true;
  try {
    const aplicacao = await obterAplicacao(item.aplicacao.id);
    if (aplicacaoSelecionada.value?.aplicacao.id === aplicacao.id) {
      aplicacaoSelecionada.value = { ...item, aplicacao };
    }
  } catch (erro) {
    toast.error('Não foi possível carregar a aplicação', {
      description: erro instanceof Error ? erro.message : undefined,
    });
  }
}

function limparFiltros(): void {
  busca.value = '';
  recorte.value = 'todas';
}

function nomeDaProva(item: AplicacaoNaTela): string {
  return item.prova?.title || 'Prova indisponível';
}

function resumoDaGeracao(item: AplicacaoNaTela): string {
  if (apiLigada) return item.aplicacao.status === 'generated' ? 'PDF pronto' : 'PDF pendente';
  return `${item.versoes.length} ${item.versoes.length === 1 ? 'versão' : 'versões'}`;
}

function abrirGeracao(): void {
  quantidadeDeVersoes.value = 1;
  embaralharQuestoes.value = false;
  embaralharAlternativas.value = false;
  identificarEstudantes.value = true;
  geracaoAberta.value = true;
}

function baixarArquivo(blob: Blob, aplicacao: AplicacaoNaTela): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const nome = `${nomeDaProva(aplicacao)}-${aplicacao.turma?.name ?? 'turma'}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  link.href = url;
  link.download = `${nome || 'prova'}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function gerarEbaixarPdf(): Promise<void> {
  const item = aplicacaoSelecionada.value;
  if (!item || !apiLigada) return;
  if (!quantidadeDeVersoesValida.value) return;

  gerandoPdf.value = true;
  try {
    const blob = await gerarPdfDaAplicacao(item.aplicacao.id, {
      quantity: quantidadeDeVersoes.value,
      shuffleQuestions: embaralharQuestoes.value,
      shuffleAlternatives: embaralharAlternativas.value,
      withStudentIdentification: identificarEstudantes.value,
      cabecalho: obterCabecalhoDaProva(item.aplicacao.examId),
    });
    const aplicacao = await obterAplicacao(item.aplicacao.id);
    aplicacaoSelecionada.value = { ...item, aplicacao, versoes: [] };
    geracaoAberta.value = false;
    baixarArquivo(blob, aplicacaoSelecionada.value);
    toast.success('PDF gerado e baixado', {
      description: 'O arquivo consolidado foi salvo na aplicação e pode ser baixado novamente.',
    });
  } catch (erro) {
    try {
      const aplicacao = await obterAplicacao(item.aplicacao.id);
      if (aplicacaoSelecionada.value?.aplicacao.id === aplicacao.id) {
        aplicacaoSelecionada.value = { ...item, aplicacao, versoes: [] };
      }
    } catch (erroDeAtualizacao) {
      toast.error('Não foi possível atualizar o estado da aplicação', {
        description: erroDeAtualizacao instanceof Error ? erroDeAtualizacao.message : undefined,
      });
    }
    toast.error('Não foi possível gerar o PDF', {
      description: erro instanceof Error ? erro.message : undefined,
    });
  } finally {
    gerandoPdf.value = false;
  }
}

async function baixarPdfExistente(): Promise<void> {
  const item = aplicacaoSelecionada.value;
  if (!item) return;
  baixandoPdf.value = true;
  try {
    const blob = await baixarPdfDaAplicacao(item.aplicacao.id);
    baixarArquivo(blob, item);
  } catch (erro) {
    toast.error('Não foi possível baixar o PDF', {
      description: erro instanceof Error ? erro.message : undefined,
    });
  } finally {
    baixandoPdf.value = false;
  }
}
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
            name="busca-aplicacao"
            autocomplete="off"
            placeholder="Buscar…"
            aria-label="Buscar por prova ou turma"
          />
        </div>
      </template>

      <p
        class="px-2.5 pb-1 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground"
      >
        Situação
      </p>
      <ItemDeRecorte
        v-for="item in recortes"
        :key="item.valor"
        :rotulo="item.rotulo"
        :total="totalPorStatus[item.valor]"
        :ativo="recorte === item.valor"
        @selecionar="recorte = item.valor"
      />

      <template #rodape>
        <p class="flex items-center justify-between px-2.5 text-xs text-muted-foreground">
          <span>Aplicações no espaço</span>
          <span class="tabular-nums">{{ totalPorStatus.todas }}</span>
        </p>
      </template>
    </PainelDaSecao>

    <div class="flex min-w-0 flex-1 flex-col bg-field">
      <div class="px-5 pb-6 pt-7 sm:px-8 sm:pt-8">
        <h1 class="text-[1.375rem] font-medium leading-tight">Aplicações</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Provas combinadas com turmas e arquivos consolidados para impressão.
        </p>
      </div>

      <div v-if="carregando" class="flex flex-col gap-2 px-5 pb-6 sm:px-8" role="status">
        <span class="sr-only">Carregando aplicações…</span>
        <div
          v-for="item in 3"
          :key="item"
          class="flex items-center gap-4 rounded-xl border bg-card px-4 py-3"
        >
          <Skeleton class="size-10 rounded-lg" />
          <div class="flex-1 space-y-2">
            <Skeleton class="h-4 w-1/2" />
            <Skeleton class="h-3 w-1/4" />
          </div>
          <Skeleton class="h-6 w-20 rounded-4xl" />
        </div>
      </div>

      <div
        v-else-if="aplicacoesFiltradas.length === 0"
        class="mx-5 mb-6 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card px-6 py-20 text-center sm:mx-8"
      >
        <CircleDashed class="size-7 text-muted-foreground" aria-hidden="true" />
        <div>
          <p class="font-medium">Nenhuma aplicação encontrada</p>
          <p class="mt-1 text-sm text-muted-foreground">
            {{
              temFiltros
                ? 'Revise a busca ou remova os filtros.'
                : 'Aplique uma prova a uma turma pelo editor.'
            }}
          </p>
        </div>
        <Button v-if="temFiltros" variant="outline" size="sm" @click="limparFiltros">
          Limpar filtros
        </Button>
      </div>

      <ul v-else class="flex flex-col gap-2 px-5 pb-6 sm:px-8">
        <li v-for="item in aplicacoesFiltradas" :key="item.aplicacao.id">
          <button
            type="button"
            class="group flex w-full items-center gap-4 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            @click="abrirDetalhe(item)"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"
            >
              <ClipboardCheck class="size-5" aria-hidden="true" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{{ nomeDaProva(item) }}</span>
              <span class="mt-0.5 block truncate text-sm text-muted-foreground">
                {{ item.turma?.name ?? 'Turma indisponível' }} · {{ item.turma?.subject ?? '—' }}
              </span>
            </span>
            <span class="hidden text-right text-sm text-muted-foreground sm:block">
              {{ resumoDaGeracao(item) }}
            </span>
            <Badge :variant="varianteDoStatusDaAplicacao(item.aplicacao.status)">
              {{ statusDaAplicacao[item.aplicacao.status].rotulo }}
            </Badge>
            <span class="hidden text-right text-sm text-muted-foreground lg:block">
              {{ formatarData(item.aplicacao.createdAt) }}
            </span>
          </button>
        </li>
      </ul>
    </div>

    <Dialog v-model:open="detalheAberto">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{
            aplicacaoSelecionada ? nomeDaProva(aplicacaoSelecionada) : ''
          }}</DialogTitle>
          <DialogDescription>
            {{ aplicacaoSelecionada?.turma?.name ?? 'Turma indisponível' }} ·
            {{ apiLigada ? 'arquivo da aplicação' : 'versões existentes' }}
          </DialogDescription>
        </DialogHeader>

        <div v-if="aplicacaoSelecionada" class="space-y-3 py-2">
          <div
            class="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-sm"
          >
            <span>Status</span>
            <Badge :variant="varianteDoStatusDaAplicacao(aplicacaoSelecionada.aplicacao.status)">
              {{ statusDaAplicacao[aplicacaoSelecionada.aplicacao.status].rotulo }}
            </Badge>
          </div>
          <div
            v-if="apiLigada && aplicacaoSelecionada.aplicacao.status === 'generated'"
            class="rounded-lg border px-3 py-3 text-sm"
          >
            <p class="font-medium">PDF consolidado pronto</p>
            <p class="mt-1 text-muted-foreground">
              O arquivo foi salvo nesta aplicação e pode ser baixado novamente.
            </p>
          </div>
          <div v-else-if="aplicacaoSelecionada.versoes.length" class="space-y-2">
            <div
              v-for="versao in aplicacaoSelecionada.versoes"
              :key="versao.id"
              class="rounded-lg border px-3 py-3 text-sm"
            >
              <div class="flex items-center justify-between gap-3">
                <span class="font-medium">Versão {{ versao.versionNumber }}</span>
                <span class="text-muted-foreground">{{ formatarData(versao.createdAt) }}</span>
              </div>
              <p class="mt-2 text-muted-foreground">
                Questões {{ versao.shuffleQuestions ? 'embaralhadas' : 'na ordem da prova' }} ·
                alternativas {{ versao.shuffleAlternatives ? 'embaralhadas' : 'na ordem da prova' }}
              </p>
              <p class="mt-1 text-muted-foreground">
                Gabarito {{ versao.answerKeyPublished ? 'publicado' : 'não publicado' }} · código
                {{ versao.publicCode }}
              </p>
            </div>
          </div>
          <p v-else class="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
            Nenhuma versão foi gerada para esta aplicação.
          </p>
        </div>

        <DialogFooter>
          <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              v-if="apiLigada && aplicacaoSelecionada?.aplicacao.pdfUrl"
              type="button"
              variant="outline"
              :disabled="baixandoPdf"
              @click="baixarPdfExistente"
            >
              {{ baixandoPdf ? 'Baixando…' : 'Baixar PDF' }}
            </Button>
            <Tooltip v-if="aplicacaoSelecionada?.aplicacao.status === 'closed'">
              <TooltipTrigger as-child>
                <span tabindex="-1">
                  <Button type="button" disabled>Gerar PDF</Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Esta aplicação está encerrada.</TooltipContent>
            </Tooltip>
            <Button v-else type="button" @click="abrirGeracao">Gerar PDF</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="geracaoAberta">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar PDF consolidado</DialogTitle>
          <DialogDescription>
            Configure as versões e a identificação antes de criar o arquivo para impressão.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-5 py-2">
          <div class="space-y-2">
            <Label for="quantidade-versoes">Quantidade de versões</Label>
            <Input
              id="quantidade-versoes"
              :model-value="quantidadeDeVersoes"
              type="number"
              min="1"
              max="20"
              step="1"
              :aria-invalid="!quantidadeDeVersoesValida"
              @update:model-value="quantidadeDeVersoes = Number($event)"
            />
            <p class="text-xs text-muted-foreground">De 1 a 20 versões inteiras por aplicação.</p>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between gap-4">
              <Label for="embaralhar-questoes" class="font-normal">Embaralhar questões</Label>
              <Switch
                id="embaralhar-questoes"
                :model-value="embaralharQuestoes"
                @update:model-value="embaralharQuestoes = $event"
              />
            </div>
            <div class="flex items-center justify-between gap-4">
              <Label for="embaralhar-alternativas" class="font-normal">
                Embaralhar alternativas
              </Label>
              <Switch
                id="embaralhar-alternativas"
                :model-value="embaralharAlternativas"
                @update:model-value="embaralharAlternativas = $event"
              />
            </div>
            <div class="flex items-center justify-between gap-4">
              <Label for="identificar-estudantes" class="font-normal">
                Identificar estudantes
              </Label>
              <Switch
                id="identificar-estudantes"
                :model-value="identificarEstudantes"
                @update:model-value="identificarEstudantes = $event"
              />
            </div>
          </div>

          <p v-if="!apiLigada" class="rounded-lg border border-dashed px-3 py-3 text-sm">
            Configure <code>VITE_API_URL</code> para gerar e salvar o PDF. As opções podem ser
            revisadas no modo de demonstração.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="geracaoAberta = false">Cancelar</Button>
          <Button
            type="button"
            :disabled="!apiLigada || gerandoPdf || !quantidadeDeVersoesValida"
            @click="gerarEbaixarPdf"
          >
            {{ gerandoPdf ? 'Gerando PDF…' : 'Gerar e baixar' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
