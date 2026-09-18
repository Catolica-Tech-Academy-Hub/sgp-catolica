<script setup lang="ts">
/**
 * Faixa branca externa — marca à esquerda e utilidades à direita. O conteúdo
 * operacional começa somente na moldura cinza abaixo dela.
 *
 * A mesma barra serve as duas perspectivas do produto. O que muda entre professor e
 * estudante é dado (quem está logado, para onde a marca leva) e uma utilidade que só
 * existe para o professor — não a composição. Duas barras separadas fariam uma mudança
 * visual precisar ser feita duas vezes, e uma delas seria esquecida.
 */
import { CircleHelp, GraduationCap, Grid2X2Plus, LogOut, UserRound } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { professorMock } from '@sgp/mocks';

const props = withDefaults(
  defineProps<{
    /** Quem está logado. Sem sessão real, é sempre um mock. */
    usuario?: { fullName: string; email: string };
    /** Destino da marca: a entrada da perspectiva de quem está logado. */
    inicio?: string;
    /** Integrações é ferramenta do professor; o estudante não tem o que integrar. */
    integracoes?: boolean;
  }>(),
  { usuario: () => professorMock, inicio: '/provas', integracoes: true },
);
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function solicitarLogout(): void {
  toast.info('Logout ainda não disponível', {
    description: 'A ação será conectada quando a autenticação for implementada.',
  });
}
</script>

<template>
  <header class="flex h-14 shrink-0 items-center gap-2 bg-background px-3 sm:px-4">
    <RouterLink
      :to="inicio"
      class="flex shrink-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span
        class="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
      >
        <GraduationCap class="size-4" aria-hidden="true" />
      </span>
      <span class="hidden text-sm font-medium sm:inline">SGP Católica</span>
    </RouterLink>

    <div class="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
      <Button v-if="integracoes" variant="ghost" size="sm" class="hidden sm:inline-flex">
        <Grid2X2Plus aria-hidden="true" />
        Integrações
      </Button>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button as-child variant="ghost" size="icon-sm">
            <RouterLink to="/suporte" aria-label="Ajuda">
              <CircleHelp aria-hidden="true" />
            </RouterLink>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ajuda</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="sm" class="gap-2 pl-1.5">
            <Avatar class="size-6">
              <AvatarFallback>
                <UserRound class="size-3.5" aria-hidden="true" />
              </AvatarFallback>
            </Avatar>
            <span class="hidden lg:inline">{{ props.usuario.fullName }}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56">
          <DropdownMenuLabel class="font-normal">
            <span class="grid leading-tight">
              <span class="truncate text-sm font-medium">{{ props.usuario.fullName }}</span>
              <span class="truncate text-xs text-muted-foreground">{{ props.usuario.email }}</span>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem @select="solicitarLogout">
            <LogOut aria-hidden="true" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>
</template>
