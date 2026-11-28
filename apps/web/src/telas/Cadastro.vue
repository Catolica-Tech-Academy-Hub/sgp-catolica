<script setup lang="ts">
/**
 * Cadastro de professor e de estudante (RF01, issues #80 e #84).
 *
 * Fica fora da casca (`meta.telaCheia`), como o login e a entrada pelo convite, no mesmo
 * layout enxuto da entrada pelo convite: quem cria a conta ainda não está no produto.
 *
 * Grava a conta no servidor. A entrada com e-mail e senha ainda é a demonstrativa do
 * login (#81, #84), por isso o sucesso leva de volta à entrada com o papel escolhido.
 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CircleAlert, GraduationCap } from '@lucide/vue';
import { toast } from 'vue-sonner';
import type { PapelUsuario } from '@sgp/shared-types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DOMINIO_POR_PAPEL,
  SENHA_MAXIMA,
  SENHA_MINIMA,
  cadastrarUsuario,
  cadastroDisponivel,
  emailDoPapel,
} from '@/lib/estado-de-usuarios';

const rota = useRoute();
const roteador = useRouter();

// O link "Criar conta" do login leva o papel que estava escolhido lá.
const papel = ref<PapelUsuario>(rota.query.papel === 'estudante' ? 'estudante' : 'professor');
const nome = ref('');
const email = ref('');
const matricula = ref('');
const senha = ref('');
const confirmacao = ref('');
const enviando = ref(false);

type Campo = 'nome' | 'email' | 'senha' | 'confirmacao' | 'servidor';
const erros = ref<Partial<Record<Campo, string>>>({});

const dominio = computed(() => DOMINIO_POR_PAPEL[papel.value]);

function validar(): boolean {
  const novos: Partial<Record<Campo, string>> = {};
  if (nome.value.trim().length < 3) novos.nome = 'Informe o nome completo.';
  if (!emailDoPapel(email.value, papel.value)) {
    novos.email = `Use o e-mail institucional de ${papel.value} (${dominio.value}).`;
  }
  if (senha.value.length < SENHA_MINIMA) {
    novos.senha = `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`;
  } else if (senha.value.length > SENHA_MAXIMA) {
    novos.senha = `A senha pode ter no máximo ${SENHA_MAXIMA} caracteres.`;
  }
  if (confirmacao.value !== senha.value) novos.confirmacao = 'As senhas não são iguais.';
  erros.value = novos;
  return Object.keys(novos).length === 0;
}

async function cadastrar(): Promise<void> {
  if (enviando.value || !validar()) {
    // Leva o foco ao primeiro campo com problema, como pede o design system.
    const primeiro = (['nome', 'email', 'senha', 'confirmacao'] as const).find(
      (campo) => erros.value[campo],
    );
    if (primeiro) document.getElementById(`cadastro-${primeiro}`)?.focus();
    return;
  }

  enviando.value = true;
  const resultado = await cadastrarUsuario({
    role: papel.value,
    fullName: nome.value,
    email: email.value,
    password: senha.value,
    registration: matricula.value,
  });
  enviando.value = false;

  if (!resultado.ok) {
    erros.value = { servidor: resultado.erro };
    return;
  }

  toast.success('Conta criada', {
    description: `${resultado.usuario.fullName} (${resultado.usuario.email})`,
  });
  await roteador.push({ path: '/login', query: { papel: papel.value } });
}

function limparErro(campo: Campo): void {
  if (erros.value[campo] || erros.value.servidor) {
    erros.value = { ...erros.value, [campo]: undefined, servidor: undefined };
  }
}
</script>

<template>
  <div class="flex min-h-svh flex-col bg-background">
    <header class="flex h-16 shrink-0 items-center px-5 sm:px-8">
      <RouterLink to="/login" class="flex items-center gap-2.5 rounded-md">
        <span
          class="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"
        >
          <GraduationCap class="size-4" aria-hidden="true" />
        </span>
        <span class="text-sm font-medium">SGP Católica</span>
      </RouterLink>
    </header>

    <main class="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:px-8">
      <form class="w-full max-w-md" novalidate @submit.prevent="cadastrar">
        <h1 class="text-center text-2xl font-normal">Criar conta</h1>
        <p class="mt-2 text-center text-sm text-muted-foreground">
          Use seu e-mail acadêmico da Católica.
        </p>

        <Alert v-if="!cadastroDisponivel" class="mt-8">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Cadastro indisponível nesta versão</AlertTitle>
          <AlertDescription>
            Criar uma conta precisa do servidor, e esta versão roda só com os dados de demonstração.
            Volte à entrada para conhecer o sistema.
          </AlertDescription>
        </Alert>

        <fieldset :disabled="!cadastroDisponivel || enviando" class="mt-8 space-y-5">
          <legend class="sr-only">Dados da conta</legend>

          <Tabs v-model="papel">
            <TabsList class="w-full">
              <TabsTrigger value="professor">Sou professor</TabsTrigger>
              <TabsTrigger value="estudante">Sou estudante</TabsTrigger>
            </TabsList>
          </Tabs>

          <div class="space-y-2">
            <Label for="cadastro-nome">Nome completo</Label>
            <Input
              id="cadastro-nome"
              v-model="nome"
              name="nome"
              autocomplete="name"
              :aria-invalid="erros.nome ? true : undefined"
              :aria-describedby="erros.nome ? 'cadastro-nome-erro' : undefined"
              @input="limparErro('nome')"
            />
            <p v-if="erros.nome" id="cadastro-nome-erro" class="text-sm text-destructive">
              {{ erros.nome }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="cadastro-email">E-mail</Label>
            <Input
              id="cadastro-email"
              v-model="email"
              type="email"
              name="email"
              inputmode="email"
              autocomplete="email"
              spellcheck="false"
              :placeholder="`seu.nome${dominio}`"
              :aria-invalid="erros.email ? true : undefined"
              :aria-describedby="erros.email ? 'cadastro-email-erro' : 'cadastro-email-dica'"
              @input="limparErro('email')"
            />
            <p v-if="erros.email" id="cadastro-email-erro" class="text-sm text-destructive">
              {{ erros.email }}
            </p>
            <p v-else id="cadastro-email-dica" class="text-xs text-muted-foreground">
              Contas de {{ papel }} usam o domínio {{ dominio }}.
            </p>
          </div>

          <div v-if="papel === 'estudante'" class="space-y-2">
            <div class="flex items-center justify-between gap-4">
              <Label for="cadastro-matricula">Matrícula</Label>
              <span class="text-xs text-muted-foreground">Opcional</span>
            </div>
            <Input
              id="cadastro-matricula"
              v-model="matricula"
              name="matricula"
              inputmode="numeric"
              autocomplete="off"
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-4">
              <Label for="cadastro-senha">Senha</Label>
              <span class="text-xs text-muted-foreground">
                Mínimo de {{ SENHA_MINIMA }} caracteres
              </span>
            </div>
            <Input
              id="cadastro-senha"
              v-model="senha"
              type="password"
              name="senha"
              autocomplete="new-password"
              :aria-invalid="erros.senha ? true : undefined"
              :aria-describedby="erros.senha ? 'cadastro-senha-erro' : undefined"
              @input="limparErro('senha')"
            />
            <p v-if="erros.senha" id="cadastro-senha-erro" class="text-sm text-destructive">
              {{ erros.senha }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="cadastro-confirmacao">Confirme a senha</Label>
            <Input
              id="cadastro-confirmacao"
              v-model="confirmacao"
              type="password"
              name="confirmacao"
              autocomplete="new-password"
              :aria-invalid="erros.confirmacao ? true : undefined"
              :aria-describedby="erros.confirmacao ? 'cadastro-confirmacao-erro' : undefined"
              @input="limparErro('confirmacao')"
            />
            <p
              v-if="erros.confirmacao"
              id="cadastro-confirmacao-erro"
              class="text-sm text-destructive"
            >
              {{ erros.confirmacao }}
            </p>
          </div>

          <p v-if="erros.servidor" class="text-sm text-destructive" role="alert">
            {{ erros.servidor }}
          </p>

          <Button type="submit" size="lg" class="w-full">
            {{ enviando ? 'Criando conta…' : 'Criar conta' }}
          </Button>
        </fieldset>

        <p class="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?
          <RouterLink
            :to="{ path: '/login', query: { papel } }"
            class="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Entrar
          </RouterLink>
        </p>
      </form>
    </main>
  </div>
</template>
