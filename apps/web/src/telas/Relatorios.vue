<script setup lang="ts">
/**
 * Relatórios de notas (RF10), em dois modos: por aplicação e consolidado.
 *
 * A tela é somente leitura sobre dado estático. As estatísticas não são digitadas em
 * lugar nenhum: `@sgp/mocks` as deriva das correções, então a média exibida no cartão e
 * as notas listadas logo abaixo dela nunca divergem.
 *
 * Exportar em CSV, Excel e PDF pertence ao RF10 mas depende de backend: os botões ficam
 * desabilitados com a explicação, no mesmo padrão de "ação sem backend" já usado em
 * Integrações e na geração de PDF.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { ChartNoAxesCombined, Download, FileSpreadsheet, FileText } from '@lucide/vue';
import { estatisticasDeAplicacaoMock, estudantesMock, versoesMock } from '@sgp/mocks';
import PainelDaSecao from '@/components/casca/PainelDaSecao.vue';
import ItemDeRecorte from '@/components/casca/ItemDeRecorte.vue';
import BarrasHorizontais from '@/components/grafico/BarrasHorizontais.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatarData, formatarPontos } from '@/lib/dominio';
import { listarAplicacoes } from '@/lib/estado-de-aplicacoes';
import { listarCorrecoes } from '@/lib/estado-de-correcoes';
import { encontrarProva } from '@/lib/estado-de-provas';
import { encontrarTurma, listarTurmas } from '@/lib/estado-de-turmas';

type Modo = 'aplicacao' | 'consolidado';

interface AplicacaoNoRelatorio {
  id: string;
  tituloDaProva: string;
  nomeDaTurma: string;
  disciplina: string;
  periodo: string;
  classId: string;
  criadaEm: string;
  teto: number;
  media: number;
  mediana: number;
  desvioPadrao: number;
  distribuicao: { faixa: string; quantidade: number }[];
  avaliados: number;
}

const carregando = ref(true);
const modo = ref<Modo>('aplicacao');
const turmaEscolhida = ref('todas');
const disciplinaEscolhida = ref('todas');
const periodoEscolhido = ref('todos');
const aplicacaoEscolhida = ref('');

onMounted(() => {
  window.setTimeout(() => {
    carregando.value = false;
  }, 350);
});

/**
 * Só aplicações com estatística entram no relatório: sem nota atribuída não há média,
 * mediana nem distribuição para exibir — e um cartão de zeros mentiria sobre a turma.
 */
const aplicacoesComRelatorio = computed<AplicacaoNoRelatorio[]>(() =>
  estatisticasDeAplicacaoMock
    .map((estatistica) => {
      const aplicacao = listarAplicacoes().find((item) => item.id === estatistica.applicationId);
      const prova = aplicacao ? encontrarProva(aplicacao.examId) : undefined;
      const turma = aplicacao ? encontrarTurma(aplicacao.classId) : undefined;

      return {
        id: estatistica.applicationId,
        tituloDaProva: prova?.title || 'Prova indisponível',
        nomeDaTurma: turma?.name || 'Turma indisponível',
        disciplina: turma?.subject ?? '',
        periodo: turma?.term ?? '',
        classId: aplicacao?.classId ?? '',
        criadaEm: aplicacao?.createdAt ?? '',
        teto: (prova?.questions ?? []).reduce((total, questao) => total + questao.score, 0),
        media: estatistica.media,
        mediana: estatistica.mediana,
        desvioPadrao: estatistica.desvioPadrao,
        distribuicao: estatistica.distribuicao,
        avaliados: estatistica.distribuicao.reduce((total, faixa) => total + faixa.quantidade, 0),
      };
    })
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm)),
);

// --- Filtros de turma, disciplina e período (RF10) ---------------------------------

const disciplinas = computed(() => [
  ...new Set(
    listarTurmas()
      .map((turma) => turma.subject)
      .filter(Boolean),
  ),
]);

const periodos = computed(() => [
  ...new Set(
    listarTurmas()
      .map((turma) => turma.term)
      .filter(Boolean),
  ),
]);

const aplicacoesFiltradas = computed(() =>
  aplicacoesComRelatorio.value.filter(
    (item) =>
      (turmaEscolhida.value === 'todas' || item.classId === turmaEscolhida.value) &&
      (disciplinaEscolhida.value === 'todas' || item.disciplina === disciplinaEscolhida.value) &&
      (periodoEscolhido.value === 'todos' || item.periodo === periodoEscolhido.value),
  ),
);

/** A aplicação escolhida acompanha o filtro: filtrar não pode deixar a tela num alvo fora da lista. */
watch(
  aplicacoesFiltradas,
  (lista) => {
    if (!lista.some((item) => item.id === aplicacaoEscolhida.value)) {
      aplicacaoEscolhida.value = lista[0]?.id ?? '';
    }
  },
  { immediate: true },
);

const relatorioAtual = computed(() =>
  aplicacoesFiltradas.value.find((item) => item.id === aplicacaoEscolhida.value),
);

/** Notas já atribuídas na aplicação escolhida; correção pendente de RF09 não tem dono. */
const notasDaAplicacao = computed(() => {
  const item = relatorioAtual.value;
  if (!item) return [];

  const versoes = versoesMock
    .filter((versao) => versao.applicationId === item.id)
    .map((versao) => versao.id);

  return listarCorrecoes()
    .filter((correcao) => versoes.includes(correcao.examVersionId) && correcao.studentId)
    .map((correcao) => ({
      id: correcao.id,
      nome:
        estudantesMock.find((estudante) => estudante.id === correcao.studentId)?.fullName ??
        'Aluno indisponível',
      matricula:
        estudantesMock.find((estudante) => estudante.id === correcao.studentId)?.registration ??
        '—',
      nota: correcao.totalScore,
      confirmadaEm: correcao.confirmedAt,
    }))
    .sort((a, b) => b.nota - a.nota);
});

const barrasDaDistribuicao = computed(() =>
  (relatorioAtual.value?.distribuicao ?? []).map((faixa) => ({
    rotulo: faixa.faixa,
    valor: faixa.quantidade,
  })),
);

const barrasDoConsolidado = computed(() =>
  aplicacoesFiltradas.value.map((item) => ({
    rotulo: item.tituloDaProva,
    valor: item.media,
  })),
);

const tetoDoConsolidado = computed(() =>
  Math.max(1, ...aplicacoesFiltradas.value.map((item) => item.teto)),
);

const totalPorModo = computed<Record<Modo, number>>(() => ({
  aplicacao: aplicacoesFiltradas.value.length,
  consolidado: aplicacoesFiltradas.value.reduce((total, item) => total + item.avaliados, 0),
}));

const modos = [
  { valor: 'aplicacao', rotulo: 'Por aplicação' },
  { valor: 'consolidado', rotulo: 'Consolidado' },
] as const;

const exportacoes = [
  { rotulo: 'CSV', icone: FileText },
  { rotulo: 'Excel', icone: FileSpreadsheet },
  { rotulo: 'PDF', icone: Download },
] as const;
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
    <PainelDaSecao>
      <p
        class="px-2.5 pb-1 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground"
      >
        Relatório
      </p>
      <ItemDeRecorte
        v-for="item in modos"
        :key="item.valor"
        :rotulo="item.rotulo"
        :total="totalPorModo[item.valor]"
        :ativo="modo === item.valor"
        @selecionar="modo = item.valor"
      />

      <div class="mt-4 flex flex-col gap-3 border-t pt-4">
        <div class="flex flex-col gap-1.5">
          <Label for="filtro-turma" class="text-xs text-muted-foreground">Turma</Label>
          <Select v-model="turmaEscolhida">
            <SelectTrigger id="filtro-turma" size="sm" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem v-for="turma in listarTurmas()" :key="turma.id" :value="turma.id">
                {{ turma.name || 'Turma sem nome' }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="filtro-disciplina" class="text-xs text-muted-foreground">Disciplina</Label>
          <Select v-model="disciplinaEscolhida">
            <SelectTrigger id="filtro-disciplina" size="sm" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem v-for="item in disciplinas" :key="item" :value="item">
                {{ item }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="filtro-periodo" class="text-xs text-muted-foreground">Período</Label>
          <Select v-model="periodoEscolhido">
            <SelectTrigger id="filtro-periodo" size="sm" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem v-for="item in periodos" :key="item" :value="item">
                {{ item }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <template #rodape>
        <p class="flex items-center justify-between px-2.5 text-xs text-muted-foreground">
          <span>Notas no recorte</span>
          <span class="tabular-nums">{{ totalPorModo.consolidado }}</span>
        </p>
      </template>
    </PainelDaSecao>

    <div class="flex min-w-0 flex-1 flex-col bg-field">
      <div class="flex flex-wrap items-center gap-3 px-5 pb-6 pt-7 sm:px-8 sm:pt-8">
        <div class="mr-auto min-w-0">
          <h1 class="text-[1.375rem] font-medium leading-tight">Relatórios</h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Desempenho das aplicações já corrigidas (RF10).
          </p>
        </div>

        <div class="flex items-center gap-2">
          <Tooltip v-for="item in exportacoes" :key="item.rotulo">
            <TooltipTrigger as-child>
              <span tabindex="-1">
                <Button variant="outline" size="sm" disabled>
                  <component :is="item.icone" aria-hidden="true" />
                  {{ item.rotulo }}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              A exportação depende do backend e entra em uma próxima fase.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div v-if="carregando" class="flex flex-col gap-4 px-5 pb-6 sm:px-8" role="status">
        <span class="sr-only">Carregando relatórios…</span>
        <div class="grid gap-3 sm:grid-cols-3">
          <Skeleton v-for="item in 3" :key="item" class="h-24 rounded-xl" />
        </div>
        <Skeleton class="h-56 rounded-xl" />
      </div>

      <div
        v-else-if="aplicacoesFiltradas.length === 0"
        class="mx-5 mb-6 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card px-6 py-20 text-center sm:mx-8"
      >
        <ChartNoAxesCombined class="size-7 text-muted-foreground" aria-hidden="true" />
        <div>
          <p class="font-medium">Nenhuma aplicação corrigida neste recorte</p>
          <p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            O relatório aparece quando uma aplicação tem notas atribuídas a alunos. Provas
            corrigidas sem identificação passam antes pela fila de Correções.
          </p>
        </div>
        <Button as-child variant="outline" size="sm">
          <RouterLink to="/correcoes">Ir para Correções</RouterLink>
        </Button>
      </div>

      <!-- Relatório por aplicação --------------------------------------------------- -->
      <div v-else-if="modo === 'aplicacao'" class="flex flex-col gap-4 px-5 pb-6 sm:px-8">
        <div class="flex flex-col gap-1.5">
          <Label for="aplicacao-do-relatorio" class="sr-only">Aplicação</Label>
          <Select v-model="aplicacaoEscolhida">
            <SelectTrigger id="aplicacao-do-relatorio" class="w-full sm:max-w-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="item in aplicacoesFiltradas" :key="item.id" :value="item.id">
                {{ item.tituloDaProva }} · {{ item.nomeDaTurma }} ·
                {{ formatarData(item.criadaEm) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <template v-if="relatorioAtual">
          <div class="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader class="pb-2">
                <CardTitle class="text-xs font-medium text-muted-foreground">Média</CardTitle>
              </CardHeader>
              <CardContent>
                <p class="text-2xl font-medium tabular-nums">
                  {{ formatarPontos(relatorioAtual.media) }}
                  <span class="text-sm text-muted-foreground">
                    de {{ formatarPontos(relatorioAtual.teto) }}
                  </span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader class="pb-2">
                <CardTitle class="text-xs font-medium text-muted-foreground">Mediana</CardTitle>
              </CardHeader>
              <CardContent>
                <p class="text-2xl font-medium tabular-nums">
                  {{ formatarPontos(relatorioAtual.mediana) }}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader class="pb-2">
                <CardTitle class="text-xs font-medium text-muted-foreground">
                  Desvio padrão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p class="text-2xl font-medium tabular-nums">
                  {{ formatarPontos(relatorioAtual.desvioPadrao) }}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle class="text-sm font-medium">Distribuição das notas</CardTitle>
            </CardHeader>
            <CardContent>
              <BarrasHorizontais
                :itens="barrasDaDistribuicao"
                :casas-decimais="0"
                titulo="Quantidade de alunos por faixa de nota"
              />
              <p class="mt-4 text-xs text-muted-foreground">
                {{ relatorioAtual.avaliados }}
                {{ relatorioAtual.avaliados === 1 ? 'aluno avaliado' : 'alunos avaliados' }} nesta
                aplicação.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent class="p-0">
              <div class="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead class="text-right">Nota</TableHead>
                      <TableHead class="text-right">Corrigida em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableEmpty v-if="notasDaAplicacao.length === 0" :colspan="4">
                      Nenhuma nota atribuída nesta aplicação.
                    </TableEmpty>
                    <TableRow v-for="nota in notasDaAplicacao" :key="nota.id">
                      <TableCell class="font-medium">{{ nota.nome }}</TableCell>
                      <TableCell class="text-muted-foreground">{{ nota.matricula }}</TableCell>
                      <TableCell class="text-right tabular-nums">
                        <span class="font-medium">{{ formatarPontos(nota.nota) }}</span>
                        <span class="text-muted-foreground">
                          / {{ formatarPontos(relatorioAtual.teto) }}
                        </span>
                      </TableCell>
                      <TableCell class="whitespace-nowrap text-right text-muted-foreground">
                        {{ formatarData(nota.confirmadaEm) }}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </template>
      </div>

      <!-- Relatório consolidado ------------------------------------------------------ -->
      <div v-else class="flex flex-col gap-4 px-5 pb-6 sm:px-8">
        <Card>
          <CardHeader>
            <CardTitle class="text-sm font-medium">Média por aplicação</CardTitle>
          </CardHeader>
          <CardContent>
            <BarrasHorizontais
              :itens="barrasDoConsolidado"
              :maximo="tetoDoConsolidado"
              :casas-decimais="1"
              titulo="Média de cada aplicação no recorte"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent class="p-0">
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prova</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Disciplina</TableHead>
                    <TableHead class="text-right">Média</TableHead>
                    <TableHead class="text-right">Mediana</TableHead>
                    <TableHead class="text-right">Avaliados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="item in aplicacoesFiltradas" :key="item.id">
                    <TableCell class="font-medium">{{ item.tituloDaProva }}</TableCell>
                    <TableCell class="text-muted-foreground">{{ item.nomeDaTurma }}</TableCell>
                    <TableCell class="text-muted-foreground">{{
                      item.disciplina || '—'
                    }}</TableCell>
                    <TableCell class="text-right tabular-nums">
                      <span class="font-medium">{{ formatarPontos(item.media) }}</span>
                      <span class="text-muted-foreground"> / {{ formatarPontos(item.teto) }} </span>
                    </TableCell>
                    <TableCell class="text-right tabular-nums text-muted-foreground">
                      {{ formatarPontos(item.mediana) }}
                    </TableCell>
                    <TableCell class="text-right tabular-nums text-muted-foreground">
                      {{ item.avaliados }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
