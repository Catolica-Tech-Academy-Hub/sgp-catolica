<script setup lang="ts">
/**
 * Entrada do estudante numa turma pelo link de convite (RF03, issue #88).
 *
 * O professor compartilha `/entrar/:codigo`; o estudante vê de qual turma é o código e
 * confirma. Fica fora da casca (`meta.telaCheia`), como o login, porque quem chega pelo
 * link ainda não está dentro do produto.
 *
 * Na demonstração, quem entra é o estudante do histórico. Cadastro de conta nova pelo
 * convite depende do login (#81, #84) e não aparece aqui ainda.
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CircleAlert, GraduationCap, UsersRound } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type TurmaDoConvite,
  consultarConvite,
  entrarPeloConvite,
  estudanteDaSessao,
  jaEstaNaTurma,
  normalizarCodigo,
} from '@/lib/estado-de-convites';

const rota = useRoute();
const roteador = useRouter();

const codigo = computed(() => normalizarCodigo(String(rota.params.codigo ?? '')));
const estudante = estudanteDaSessao();

const carregando = ref(true);
const turma = ref<TurmaDoConvite | undefined>();
const recusa = ref('');

onMounted(async () => {
  turma.value = await consultarConvite(codigo.value);
  carregando.value = false;
});

const jaMatriculado = computed(() => jaEstaNaTurma(codigo.value, estudante.id));
const arquivada = computed(() => turma.value?.status === 'archived');

async function verMinhasNotas(): Promise<void> {
  await roteador.push('/estudante');
}

async function entrar(): Promise<void> {
  const resultado = entrarPeloConvite(codigo.value, estudante.id);
  if (resultado.tipo === 'recusado') {
    recusa.value = resultado.motivo;
    return;
  }
  toast.success(
    resultado.tipo === 'matriculado'
      ? `Você entrou em ${turma.value?.name}`
      : `Você já estava em ${turma.value?.name}`,
    { description: 'As notas desta turma aparecem no seu histórico quando forem lançadas.' },
  );
  await verMinhasNotas();
}
</script>

<template>
  <div class="flex min-h-svh flex-col bg-background">
    <header class="flex h-16 shrink-0 items-center px-5 sm:px-8">
      <div class="flex items-center gap-2.5">
        <span
          class="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"
        >
          <GraduationCap class="size-4" aria-hidden="true" />
        </span>
        <span class="text-sm font-medium">SGP Católica</span>
      </div>
    </header>

    <main class="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:px-8">
      <div class="w-full max-w-md">
        <h1 class="text-center text-2xl font-normal">Entrar na turma</h1>
        <p class="mt-2 text-center text-sm text-muted-foreground">
          Código de convite <span class="font-medium text-foreground">{{ codigo }}</span>
        </p>

        <div v-if="carregando" class="mt-8 space-y-3" aria-busy="true" aria-live="polite">
          <Skeleton class="h-6 w-2/3" />
          <Skeleton class="h-4 w-1/2" />
          <Skeleton class="h-10 w-full" />
        </div>

        <Alert v-else-if="!turma" variant="destructive" class="mt-8">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Código inválido</AlertTitle>
          <AlertDescription>
            Este código não abre nenhuma turma. Ele pode ter sido substituído pelo professor: peça o
            link atual a ele.
          </AlertDescription>
        </Alert>

        <Card v-else class="mt-8">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 text-base font-medium">
              <UsersRound class="size-4 text-muted-foreground" aria-hidden="true" />
              {{ turma.name || 'Turma sem nome' }}
            </CardTitle>
            <CardDescription>
              {{ turma.subject || 'Disciplina não informada' }} · {{ turma.term }} · Professor(a)
              {{ turma.teacherName }}
            </CardDescription>
          </CardHeader>

          <CardContent class="space-y-4">
            <Alert v-if="recusa" variant="destructive" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Não foi possível entrar</AlertTitle>
              <AlertDescription>{{ recusa }}</AlertDescription>
            </Alert>

            <template v-if="jaMatriculado">
              <p class="text-sm">Você já está nesta turma.</p>
              <Button class="w-full" size="lg" @click="verMinhasNotas">Ver minhas notas</Button>
            </template>

            <template v-else-if="arquivada">
              <p class="text-sm text-muted-foreground">
                Esta turma foi arquivada e não aceita novas matrículas.
              </p>
            </template>

            <template v-else>
              <p class="text-sm text-muted-foreground">
                Você vai entrar como
                <span class="font-medium text-foreground">{{ estudante.fullName }}</span>
                ({{ estudante.email }}).
              </p>
              <Button class="w-full" size="lg" @click="entrar">Entrar na turma</Button>
            </template>
          </CardContent>
        </Card>

        <p class="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          Nesta fase, quem entra é o estudante da demonstração. O cadastro de conta nova pelo
          convite chega junto com o login.
        </p>
      </div>
    </main>
  </div>
</template>
