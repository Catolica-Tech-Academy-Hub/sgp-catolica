<script setup lang="ts">
/**
 * Editor de prova — protótipo em avaliação (issue #12; ver `src/lib/blocos-da-prova.ts`
 * para o porquê do modelo não estar em `@sgp/shared-types` ainda).
 *
 * É um **modo**, não uma seção: a rota declara `meta.telaCheia`, então `App.vue` não
 * renderiza a casca e o editor assume a janela inteira, com barra e saída próprias.
 *
 * Três zonas, no idioma da referência:
 *
 * - esquerda, a estrutura: a prova inteira em miniaturas numeradas;
 * - centro, a folha: papel A4 com o cabeçalho impresso, só conteúdo;
 * - direita, um painel de largura estável: propriedades, conteúdos ou banco de
 *   questões, conforme a tarefa atual.
 *
 * Cada folha usa 210 × 297 mm e espaços de resposta em medidas físicas. Um
 * ResizeObserver mede os blocos e recalcula as páginas sem partir questões. A geração
 * de PDF continua futura; aqui a paginação é a referência visual de autoria e preview.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { FilePlus2, Library } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { turmasMock } from '@sgp/mocks';
import type { Questao } from '@sgp/shared-types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import BarraDoEditor from '@/components/prova/BarraDoEditor.vue';
import EstruturaDaProva from '@/components/prova/EstruturaDaProva.vue';
import BlocoNaFolha from '@/components/prova/BlocoNaFolha.vue';
import CabecalhoNaFolha from '@/components/prova/CabecalhoNaFolha.vue';
import AcoesDoBloco from '@/components/prova/AcoesDoBloco.vue';
import PropriedadesDoBloco from '@/components/prova/PropriedadesDoBloco.vue';
import PainelDeQuestoesDoBanco from '@/components/prova/PainelDeQuestoesDoBanco.vue';
import PainelDeConteudos from '@/components/prova/PainelDeConteudos.vue';
import PreVisualizacaoDaProva from '@/components/prova/PreVisualizacaoDaProva.vue';
import type { CabecalhoDaProva } from '@/lib/cabecalhos-da-prova';
import {
  atualizarCabecalhoDaProva,
  conteudoDoModelo,
  modelosDeCabecalho,
  obterCabecalhoDaProva,
  salvarModeloDeCabecalho,
} from '@/lib/cabecalhos-da-prova';
import {
  encontrarProva,
  obterBlocosDaProva,
  atualizarQuestoesDaProva,
} from '@/lib/estado-de-provas';
import { criarAplicacao } from '@/lib/estado-de-aplicacoes';
import {
  encontrarQuestaoDoBanco,
  questaoEstaNoBanco,
  salvarQuestaoNoBanco,
} from '@/lib/estado-de-questoes';
import {
  type BlocoDaProva,
  type BlocoDeQuestao,
  type TipoDeInsercao,
  MAXIMO_DE_QUESTOES,
  contarQuestoes,
  criarBloco,
  criarBlocoDeQuestao,
  criarBlocoDeQuestaoVazia,
  duplicarBloco as duplicarBlocoDaProva,
  numeracaoDasQuestoes,
  questoesParaProva,
  totalDePontos,
} from '@/lib/blocos-da-prova';

const rota = useRoute();
const carregando = ref(true);
const prova = ref(encontrarProva(rota.params.id as string) ?? null);
const blocos = ref<BlocoDaProva[]>(prova.value ? obterBlocosDaProva(prova.value) : []);
const cabecalho = computed(() => (prova.value ? obterCabecalhoDaProva(prova.value.id) : null));

onMounted(() => {
  window.setTimeout(() => {
    carregando.value = false;
  }, 350);
});

// Cada bloco de questão colapsa de volta para `Prova.questions`, na ordem da folha.
watch(
  blocos,
  () => {
    if (prova.value) atualizarQuestoesDaProva(prova.value.id, questoesParaProva(blocos.value));
  },
  { deep: true },
);

const totalPontos = computed(() => totalDePontos(blocos.value));
const totalQuestoes = computed(() => contarQuestoes(blocos.value));
const noLimite = computed(() => totalQuestoes.value >= MAXIMO_DE_QUESTOES);
const numeracao = computed(() => numeracaoDasQuestoes(blocos.value));

const idsDeQuestaoNaFolha = computed(() =>
  blocos.value
    .filter((bloco): bloco is BlocoDeQuestao => bloco.type === 'questao')
    .map((bloco) => bloco.questionId),
);

function questaoDoBloco(bloco: BlocoDaProva): Questao | undefined {
  if (bloco.type !== 'questao') return undefined;
  return bloco.rascunho ?? encontrarQuestaoDoBanco(bloco.questionId);
}

/**
 * Seleção por id, não por índice: mover um bloco não pode mudar quem está
 * selecionado. `null` significa o cabeçalho da prova, que é sempre selecionável.
 */
const selecionado = ref<string | null>(null);
const indiceSelecionado = computed(() =>
  blocos.value.findIndex((bloco) => bloco.id === selecionado.value),
);
const blocoSelecionado = computed(() =>
  indiceSelecionado.value >= 0 ? blocos.value[indiceSelecionado.value] : null,
);

const folha = ref<HTMLElement | null>(null);
const previewAberto = ref(false);
const aplicacaoAberta = ref(false);
const turmaEscolhida = ref('');
const turmasAtivas = turmasMock.filter((turma) => turma.status === 'active');

function abrirDialogoDeAplicacao(): void {
  turmaEscolhida.value = '';
  aplicacaoAberta.value = true;
}

function criarAplicacaoDaProva(): void {
  if (!prova.value || !turmaEscolhida.value) return;
  criarAplicacao({ examId: prova.value.id, classId: turmaEscolhida.value });
  aplicacaoAberta.value = false;
  toast.success('Aplicação criada', {
    description: 'A aplicação está em rascunho e ainda não gera PDF.',
  });
}

/**
 * O papel continua sendo calculado em tamanho A4 real, mas sua representação pode
 * reduzir para caber entre as duas barras laterais. Assim o canvas não ganha uma
 * rolagem horizontal por poucos pixels e a paginação não muda com a viewport.
 */
const PIXELS_POR_MM = 96 / 25.4;
const LARGURA_A4_PX = 210 * PIXELS_POR_MM;
const ALTURA_A4_PX = 297 * PIXELS_POR_MM;
const escalaDaFolha = ref(1);
const estiloDaFolha = computed(() => ({
  '--escala-da-folha': String(escalaDaFolha.value),
  '--largura-da-folha-visivel': `${LARGURA_A4_PX * escalaDaFolha.value}px`,
  '--altura-da-folha-visivel': `${ALTURA_A4_PX * escalaDaFolha.value}px`,
}));
let observadorDoCanvas: ResizeObserver | null = null;

/**
 * Paginação visual na medida real do A4. As alturas vêm dos próprios blocos
 * renderizados; por isso texto, alternativas e imagens recalculam a quebra sem
 * manter uma tabela frágil de estimativas por tipo.
 */
const alturasDosBlocos = ref<Record<string, number>>({});
const alturaDoCabecalho = ref(180);
// 297 mm menos 32 mm de margens e uma pequena folga para borda/arredondamento.
const ALTURA_UTIL_DA_PAGINA = 265 * PIXELS_POR_MM - 4;
const ESPACO_ENTRE_BLOCOS = 20;
let observadorDePaginacao: ResizeObserver | null = null;

const paginas = computed<BlocoDaProva[][]>(() => {
  const resultado: BlocoDaProva[][] = [[]];
  let paginaAtual = resultado[0];
  let alturaUsada = cabecalho.value ? alturaDoCabecalho.value : 0;
  let temConteudo = Boolean(cabecalho.value);

  for (const bloco of blocos.value) {
    const altura = alturasDosBlocos.value[bloco.id] ?? 96;
    const alturaNecessaria = altura + (temConteudo ? ESPACO_ENTRE_BLOCOS : 0);
    if (temConteudo && alturaUsada + alturaNecessaria > ALTURA_UTIL_DA_PAGINA) {
      paginaAtual = [];
      resultado.push(paginaAtual);
      alturaUsada = 0;
      temConteudo = false;
    }
    paginaAtual.push(bloco);
    alturaUsada += altura + (temConteudo ? ESPACO_ENTRE_BLOCOS : 0);
    temConteudo = true;
  }

  return resultado;
});

function observarElementosDaFolha(): void {
  observadorDePaginacao?.disconnect();
  if (!folha.value || typeof ResizeObserver === 'undefined') return;
  observadorDePaginacao = new ResizeObserver((entradas) => {
    for (const entrada of entradas) {
      const elemento = entrada.target as HTMLElement;
      const altura =
        entrada.borderBoxSize?.[0]?.blockSize ?? elemento.getBoundingClientRect().height;
      if (elemento.dataset.medicaoCabecalho !== undefined) {
        if (Math.abs(alturaDoCabecalho.value - altura) > 0.5) alturaDoCabecalho.value = altura;
        continue;
      }
      const blocoId = elemento.dataset.medicaoBloco;
      if (blocoId && Math.abs((alturasDosBlocos.value[blocoId] ?? 0) - altura) > 0.5) {
        alturasDosBlocos.value[blocoId] = altura;
      }
    }
  });
  folha.value
    .querySelectorAll<HTMLElement>('[data-medicao-cabecalho], [data-medicao-bloco]')
    .forEach((elemento) => observadorDePaginacao?.observe(elemento));
}

function ajustarFolhaAoCanvas(): void {
  if (!folha.value) return;
  const estilo = window.getComputedStyle(folha.value);
  const espacoDisponivel =
    folha.value.clientWidth -
    Number.parseFloat(estilo.paddingLeft) -
    Number.parseFloat(estilo.paddingRight);
  const proximaEscala = Math.min(1, espacoDisponivel / LARGURA_A4_PX);
  escalaDaFolha.value = Math.max(0.3, proximaEscala);
}

function observarLarguraDoCanvas(): void {
  observadorDoCanvas?.disconnect();
  if (!folha.value || typeof ResizeObserver === 'undefined') return;
  ajustarFolhaAoCanvas();
  observadorDoCanvas = new ResizeObserver(ajustarFolhaAoCanvas);
  observadorDoCanvas.observe(folha.value);
}

watch(
  () =>
    `${carregando.value}:${paginas.value.map((pagina) => pagina.map((bloco) => bloco.id).join(',')).join('|')}`,
  async () => {
    await nextTick();
    observarElementosDaFolha();
    observarLarguraDoCanvas();
  },
  { immediate: true, flush: 'post' },
);

onBeforeUnmount(() => {
  observadorDePaginacao?.disconnect();
  observadorDoCanvas?.disconnect();
});

/** Rola a folha até o bloco escolhido na trilha, para os dois lados ficarem em sincronia. */
type PainelDireito = 'propriedades' | 'banco' | 'conteudos';
const painelDireito = ref<PainelDireito>('propriedades');

async function selecionar(id: string | null, manterPainel = false): Promise<void> {
  selecionado.value = id;
  if (!manterPainel) painelDireito.value = 'propriedades';
  if (!id) return;
  await nextTick();
  folha.value
    ?.querySelector(`[data-bloco="${id}"]`)
    ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function atualizarBloco(indice: number, blocoAtualizado: BlocoDaProva): void {
  blocos.value[indice] = blocoAtualizado;
}

function indiceDoBloco(blocoId: string): number {
  return blocos.value.findIndex((bloco) => bloco.id === blocoId);
}

function moverBloco(indice: number, direcao: 'cima' | 'baixo'): void {
  const alvo = direcao === 'cima' ? indice - 1 : indice + 1;
  if (alvo < 0 || alvo >= blocos.value.length) return;
  const atual = blocos.value[indice];
  blocos.value[indice] = blocos.value[alvo];
  blocos.value[alvo] = atual;
}

function removerBloco(): void {
  const indice = indiceSelecionado.value;
  if (indice < 0) return;
  const [removido] = blocos.value.splice(indice, 1);
  selecionado.value = null;
  toast('Bloco removido da prova', {
    description: 'A remoção pode ser desfeita.',
    action: {
      label: 'Desfazer',
      onClick: () => {
        blocos.value.splice(indice, 0, removido);
        selecionado.value = removido.id;
      },
    },
  });
}

function duplicarBloco(): void {
  const indice = indiceSelecionado.value;
  if (indice < 0) return;
  const original = blocos.value[indice];
  if (original.type === 'questao' && noLimite.value) {
    toast.error(`A prova já atingiu o limite de ${MAXIMO_DE_QUESTOES} questões.`);
    return;
  }
  const copia = duplicarBlocoDaProva(original);
  blocos.value.splice(indice + 1, 0, copia);
  void selecionar(copia.id);
  toast.success('Bloco duplicado');
}

/** Insere depois do bloco selecionado; sem seleção, no fim da folha. */
function posicaoDeInsercao(): number {
  return indiceSelecionado.value >= 0 ? indiceSelecionado.value + 1 : blocos.value.length;
}

function adicionarBloco(tipo: TipoDeInsercao): void {
  const ehQuestao = tipo.startsWith('questao-');
  if (ehQuestao && noLimite.value) {
    toast.error(`A prova já atingiu o limite de ${MAXIMO_DE_QUESTOES} questões.`);
    return;
  }
  const posicao = posicaoDeInsercao();
  const novo =
    tipo === 'questao-objetiva'
      ? criarBlocoDeQuestaoVazia('objetiva')
      : tipo === 'questao-curta'
        ? criarBlocoDeQuestaoVazia('curta')
        : tipo === 'questao-longa'
          ? criarBlocoDeQuestaoVazia('longa')
          : criarBloco(tipo);
  blocos.value.splice(posicao, 0, novo);
  void selecionar(novo.id);
}

function aoAdicionarQuestao(questao: Questao): void {
  if (noLimite.value) return;
  const pontuacaoPadrao = questao.type === 'discursiva' ? (questao.maxScore ?? 1) : 1;
  const novo = criarBlocoDeQuestao(questao, pontuacaoPadrao);
  blocos.value.splice(posicaoDeInsercao(), 0, novo);
  void selecionar(novo.id, true);
  toast.success('Questão adicionada à folha');
}

function salvarQuestaoSelecionadaNoBanco(): void {
  const bloco = blocoSelecionado.value;
  if (bloco?.type !== 'questao') return;
  const questao = questaoDoBloco(bloco);
  if (!questao?.statement.trim()) {
    toast.error('Escreva o enunciado antes de salvar a questão.');
    return;
  }
  if (questao.type === 'objetiva' && !questao.correctAlternativeId) {
    toast.error('Selecione a alternativa correta antes de salvar.');
    return;
  }
  const questaoParaSalvar =
    questao.type === 'discursiva' ? { ...questao, maxScore: bloco.pontuacao } : questao;
  const resultado = salvarQuestaoNoBanco(questaoParaSalvar);
  toast.success(resultado === 'criada' ? 'Questão salva no banco' : 'Questão atualizada no banco');
}

function atualizarCabecalho(atualizado: CabecalhoDaProva): void {
  if (prova.value) atualizarCabecalhoDaProva(prova.value.id, atualizado);
}

function salvarModelo(nome: string): void {
  if (!cabecalho.value) return;
  salvarModeloDeCabecalho(nome, cabecalho.value);
  toast.success('Modelo de cabeçalho salvo', {
    description: 'Ele já pode ser aplicado em outras provas neste navegador.',
  });
}

function aplicarModelo(modeloId: string): void {
  const conteudo = conteudoDoModelo(modeloId);
  if (!conteudo || !prova.value) return;
  atualizarCabecalhoDaProva(prova.value.id, conteudo);
  toast.success('Modelo aplicado ao cabeçalho');
}
</script>

<template>
  <div class="flex h-svh flex-col overflow-hidden bg-field">
    <div v-if="carregando" class="flex flex-1 flex-col gap-4 p-6">
      <span class="sr-only" role="status">Carregando a prova…</span>
      <Skeleton class="h-10 w-72" />
      <Skeleton class="h-full w-full max-w-3xl self-center" />
    </div>

    <div
      v-else-if="!prova"
      class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <h1 class="text-xl font-semibold">Prova não encontrada</h1>
      <p class="max-w-sm text-sm text-muted-foreground">
        Ela pode ter sido removida ou o endereço está incorreto.
      </p>
      <Button as-child variant="outline">
        <RouterLink to="/provas">Voltar para o acervo</RouterLink>
      </Button>
    </div>

    <template v-else>
      <BarraDoEditor
        :titulo="prova.title"
        :status="prova.status"
        :total-de-questoes="totalQuestoes"
        :total-de-pontos="totalPontos"
        @update:titulo="prova.title = $event"
        @visualizar="previewAberto = true"
        @aplicar="abrirDialogoDeAplicacao"
      />

      <Dialog v-model:open="aplicacaoAberta">
        <DialogContent class="sm:max-w-md">
          <form @submit.prevent="criarAplicacaoDaProva">
            <DialogHeader>
              <DialogTitle>Aplicar a uma turma</DialogTitle>
              <DialogDescription>
                Escolha uma turma ativa. A aplicação será criada como rascunho.
              </DialogDescription>
            </DialogHeader>

            <div class="space-y-2 py-4">
              <Label for="turma-da-aplicacao">Turma de destino</Label>
              <Select v-model="turmaEscolhida">
                <SelectTrigger id="turma-da-aplicacao" aria-label="Turma de destino">
                  <SelectValue placeholder="Selecione uma turma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="turma in turmasAtivas" :key="turma.id" :value="turma.id">
                    {{ turma.name }} · {{ turma.term }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" @click="aplicacaoAberta = false">
                Cancelar
              </Button>
              <Button type="submit" :disabled="!turmaEscolhida">Criar aplicação</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div class="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row">
        <EstruturaDaProva
          :blocos="blocos"
          :paginas="paginas"
          :numeracao="numeracao"
          :selecionado="selecionado"
          :questao-por-bloco="questaoDoBloco"
          @selecionar="selecionar"
          @mover="moverBloco"
        />

        <!-- O canvas rola; a barra de autoria permanece ancorada sobre ele. -->
        <div class="relative min-w-0 flex-1 overflow-hidden rounded-xl border bg-card">
          <div
            ref="folha"
            class="scrollbar-sutil h-full overflow-x-hidden overflow-y-auto px-3 pb-24 pt-6"
          >
            <Alert v-if="prova.status !== 'draft'" class="mx-auto mb-4 w-full max-w-205">
              <AlertDescription>
                <template v-if="prova.status === 'ready'">
                  Esta prova já tem aplicações geradas. Mudar as questões aqui não altera PDFs já
                  emitidos — para isso, gere uma nova aplicação.
                </template>
                <template v-else>
                  Prova encerrada: não aceita novas aplicações, mas o conteúdo pode ser revisado
                  normalmente.
                </template>
              </AlertDescription>
            </Alert>

            <div :style="estiloDaFolha" class="mx-auto flex w-full flex-col items-center gap-5">
              <div
                v-for="(pagina, indiceDaPagina) in paginas"
                :key="`pagina-${indiceDaPagina}`"
                class="moldura-da-folha shrink-0"
              >
                <article
                  class="folha-a4 relative flex flex-col gap-5 rounded-md border border-sheet-border bg-sheet text-sheet-foreground shadow-sm"
                >
                  <div
                    v-if="cabecalho && indiceDaPagina === 0"
                    data-medicao-cabecalho
                    class="relative rounded-sm transition-shadow"
                    :class="
                      selecionado === null
                        ? 'ring-2 ring-primary ring-offset-4 ring-offset-sheet'
                        : ''
                    "
                  >
                    <button
                      type="button"
                      class="absolute inset-0 z-10 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      :aria-pressed="selecionado === null"
                      aria-label="Editar cabeçalho da prova"
                      @click="selecionar(null)"
                    />
                    <CabecalhoNaFolha
                      class="pointer-events-none"
                      :titulo="prova.title"
                      :descricao="prova.description"
                      :total-de-pontos="totalPontos"
                      :cabecalho="cabecalho"
                    />
                  </div>

                  <p
                    v-if="blocos.length === 0 && indiceDaPagina === 0"
                    class="py-10 text-center text-sm text-sheet-foreground/50"
                  >
                    A folha está em branco. Adicione a primeira questão para começar.
                  </p>

                  <div
                    v-for="bloco in pagina"
                    :key="bloco.id"
                    :data-bloco="bloco.id"
                    :data-medicao-bloco="bloco.id"
                    class="relative cursor-text"
                    @click="selecionar(bloco.id)"
                    @focusin="selecionado = bloco.id"
                  >
                    <BlocoNaFolha
                      :bloco="bloco"
                      :questao="questaoDoBloco(bloco)"
                      :numero="numeracao[bloco.id]"
                      :selecionado="selecionado === bloco.id"
                      @update:bloco="
                        (atualizado) => atualizarBloco(indiceDoBloco(bloco.id), atualizado)
                      "
                    />
                    <AcoesDoBloco
                      v-if="selecionado === bloco.id"
                      :pode-subir="indiceDoBloco(bloco.id) > 0"
                      :pode-descer="indiceDoBloco(bloco.id) < blocos.length - 1"
                      @mover="(direcao) => moverBloco(indiceDoBloco(bloco.id), direcao)"
                      @duplicar="duplicarBloco"
                      @remover="removerBloco"
                    />
                  </div>

                  <span class="numero-da-pagina" aria-label="Página">
                    {{ indiceDaPagina + 1 }} / {{ paginas.length }}
                  </span>
                </article>
              </div>
            </div>
          </div>

          <div
            class="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-3"
          >
            <div
              role="toolbar"
              aria-label="Ferramentas de autoria"
              class="pointer-events-auto flex items-center gap-1.5 rounded-xl border bg-background/95 p-1.5 shadow-md backdrop-blur-sm"
            >
              <Button
                variant="outline"
                size="sm"
                :disabled="noLimite"
                @click="painelDireito = 'banco'"
              >
                <Library aria-hidden="true" />
                Banco de questões
              </Button>

              <Button size="sm" :disabled="noLimite" @click="painelDireito = 'conteudos'">
                <FilePlus2 aria-hidden="true" />
                Nova questão
              </Button>

              <p v-if="noLimite" class="sr-only" role="status">
                Limite de {{ MAXIMO_DE_QUESTOES }} questões atingido.
              </p>
            </div>
          </div>
        </div>

        <PainelDeQuestoesDoBanco
          v-if="painelDireito === 'banco'"
          :ids-ja-na-prova="idsDeQuestaoNaFolha"
          :no-limite="noLimite"
          @adicionar="aoAdicionarQuestao"
          @fechar="painelDireito = 'propriedades'"
        />
        <PainelDeConteudos
          v-else-if="painelDireito === 'conteudos'"
          @adicionar="adicionarBloco"
          @fechar="painelDireito = 'propriedades'"
        />
        <PropriedadesDoBloco
          v-else-if="cabecalho"
          :bloco="blocoSelecionado"
          :questao="blocoSelecionado ? questaoDoBloco(blocoSelecionado) : undefined"
          :numero="blocoSelecionado ? numeracao[blocoSelecionado.id] : undefined"
          :posicao="indiceSelecionado + 1"
          :total="blocos.length"
          :total-de-pontos="totalPontos"
          :descricao-da-prova="prova.description ?? ''"
          :cabecalho="cabecalho"
          :modelos-de-cabecalho="modelosDeCabecalho"
          :questao-esta-no-banco="
            blocoSelecionado?.type === 'questao' && questaoEstaNoBanco(blocoSelecionado.questionId)
          "
          @update:bloco="(atualizado) => atualizarBloco(indiceSelecionado, atualizado)"
          @update:descricao="prova.description = $event || undefined"
          @update:cabecalho="atualizarCabecalho"
          @aplicar-modelo="aplicarModelo"
          @salvar-modelo="salvarModelo"
          @salvar-no-banco="salvarQuestaoSelecionadaNoBanco"
        />
      </div>

      <PreVisualizacaoDaProva
        v-if="cabecalho"
        v-model:aberto="previewAberto"
        :titulo="prova.title"
        :descricao="prova.description"
        :total-de-pontos="totalPontos"
        :cabecalho="cabecalho"
        :blocos="blocos"
        :paginas="paginas"
        :numeracao="numeracao"
        :questao-por-bloco="questaoDoBloco"
      />
    </template>
  </div>
</template>

<style scoped>
.folha-a4 {
  width: 210mm;
  height: 297mm;
  overflow: hidden;
  padding: 16mm;
  transform: scale(var(--escala-da-folha));
  transform-origin: left top;
}

.moldura-da-folha {
  width: var(--largura-da-folha-visivel);
  height: var(--altura-da-folha-visivel);
}

.numero-da-pagina {
  position: absolute;
  right: 16mm;
  bottom: 6mm;
  color: color-mix(in oklab, var(--sheet-foreground) 48%, transparent);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
</style>
