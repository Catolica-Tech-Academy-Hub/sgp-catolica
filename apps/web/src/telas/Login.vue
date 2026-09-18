<script setup lang="ts">
/**
 * Entrada navegável da fase N1. Valida apenas a forma dos campos e segue para o
 * protótipo; autenticação, token e sessão continuam fora desta entrega.
 *
 * O papel escolhido aqui é o que decide qual das duas perspectivas do produto abre: o
 * espaço de trabalho do professor ou o histórico do estudante. Não é autorização — sem
 * backend, é só a porta de entrada da demonstração, e a própria tela diz isso.
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Globe2, GraduationCap } from '@lucide/vue';
import type { PapelUsuario } from '@sgp/shared-types';
import ilustracaoDeProvaOnline from '@/assets/illustrations/online-test.svg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const roteador = useRouter();
const papel = ref<PapelUsuario>('professor');
const email = ref('');
const senha = ref('');
const erro = ref('');

/** RF01 separa os domínios de e-mail por papel; o placeholder acompanha a escolha. */
const exemploDeEmail = computed(() =>
  papel.value === 'professor' ? 'seu.nome@catolicasc.org.br' : 'seu.nome@catolicasc.edu.br',
);

const destino = computed(() => (papel.value === 'professor' ? '/provas' : '/estudante'));

async function entrar(): Promise<void> {
  if (!email.value.includes('@')) {
    erro.value = 'Informe um e-mail válido.';
    return;
  }

  if (senha.value.length < 8) {
    erro.value = 'A senha precisa ter pelo menos 8 caracteres.';
    return;
  }

  erro.value = '';
  await roteador.push(destino.value);
}
</script>

<template>
  <div class="grid min-h-svh bg-primary lg:grid-cols-2">
    <section
      class="relative hidden min-h-svh overflow-hidden px-10 py-8 text-primary-foreground lg:flex lg:flex-col xl:px-16 xl:py-10"
      aria-label="Apresentação do SGP Católica"
    >
      <div class="flex items-center gap-2.5 text-sm font-medium">
        <span
          class="flex size-8 items-center justify-center rounded-md bg-primary-foreground text-primary"
        >
          <GraduationCap class="size-4" aria-hidden="true" />
        </span>
        SGP Católica
      </div>

      <div class="my-auto mx-auto w-full max-w-xl">
        <div class="mb-7 max-w-md">
          <p class="text-sm text-primary-foreground/65">Do planejamento à correção</p>
          <h1 class="mt-2 text-3xl font-medium leading-tight xl:text-4xl">
            Provas mais simples de criar, aplicar e acompanhar.
          </h1>
        </div>

        <div class="mt-8 flex min-h-72 items-center justify-center xl:min-h-96">
          <img
            :src="ilustracaoDeProvaOnline"
            class="login-illustration h-auto w-full max-w-xl"
            alt="Ilustração de uma professora preparando uma avaliação digital"
          />
        </div>
      </div>

      <p class="text-xs text-primary-foreground/55">
        Sistema de Geração de Provas · ambiente demonstrativo
      </p>
    </section>

    <section class="flex min-h-svh flex-col rounded-none bg-background lg:rounded-l-2xl">
      <header class="flex h-16 shrink-0 items-center justify-between px-5 sm:px-8">
        <Button variant="outline" size="sm">
          <Globe2 aria-hidden="true" />
          Português
        </Button>

        <div class="flex items-center gap-2 lg:hidden">
          <span
            class="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
          >
            <GraduationCap class="size-4" aria-hidden="true" />
          </span>
          <span class="text-sm font-medium">SGP Católica</span>
        </div>
      </header>

      <main class="flex flex-1 items-center justify-center px-5 pb-20 pt-8 sm:px-8">
        <form class="w-full max-w-md" novalidate @submit.prevent="entrar">
          <div class="mb-8 text-center">
            <div class="mx-auto flex w-fit items-center gap-2.5">
              <span
                class="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground"
              >
                <GraduationCap class="size-5" aria-hidden="true" />
              </span>
              <span class="text-xl font-medium">SGP Católica</span>
            </div>
            <h1 class="mt-6 text-2xl font-normal">Entre no seu espaço de trabalho</h1>
            <p class="mt-2 text-sm text-muted-foreground">
              Use seu acesso acadêmico para continuar.
            </p>
          </div>

          <div class="space-y-5">
            <Tabs v-model="papel">
              <TabsList class="w-full">
                <TabsTrigger value="professor">Sou professor</TabsTrigger>
                <TabsTrigger value="estudante">Sou estudante</TabsTrigger>
              </TabsList>
            </Tabs>

            <div class="space-y-2">
              <Label for="email">E-mail</Label>
              <Input
                id="email"
                v-model="email"
                type="email"
                name="email"
                autocomplete="email"
                :placeholder="exemploDeEmail"
                :aria-invalid="erro && !email.includes('@') ? true : undefined"
              />
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-4">
                <Label for="senha">Senha</Label>
                <span class="text-xs text-muted-foreground">Mínimo de 8 caracteres</span>
              </div>
              <Input
                id="senha"
                v-model="senha"
                type="password"
                name="senha"
                autocomplete="current-password"
                placeholder="Digite sua senha"
                :aria-invalid="erro && senha.length < 8 ? true : undefined"
              />
            </div>

            <p v-if="erro" class="text-sm text-destructive" role="alert">{{ erro }}</p>

            <Button type="submit" size="lg" class="w-full">Entrar</Button>
          </div>

          <p class="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            Nesta fase, o acesso apenas valida os campos e abre o protótipo navegável. O papel
            escolhido decide qual perspectiva abre, não o que você pode ver.
          </p>
        </form>
      </main>
    </section>
  </div>
</template>

<style scoped>
.login-illustration {
  animation: flutuar 7s ease-in-out infinite;
  transform-origin: center;
}

@keyframes flutuar {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-illustration {
    animation: none;
  }
}
</style>
