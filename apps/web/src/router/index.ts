import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import Provas from '@/telas/Provas.vue';

/**
 * Rotas da aplicacao web.
 *
 * N1: a tela de Provas e a base do produto. As demais secoes existem para a
 * navegacao ficar completa e serao preenchidas nas proximas entregas.
 */
const rotas: RouteRecordRaw[] = [
  { path: '/', redirect: '/login' },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/telas/Login.vue'),
    meta: { titulo: 'Entrar', telaCheia: true },
  },
  {
    path: '/provas',
    name: 'provas',
    component: Provas,
    meta: { titulo: 'Provas' },
  },
  {
    path: '/provas/:id',
    name: 'provas-editor',
    component: () => import('@/telas/EditorDeProva.vue'),
    // Modo de trabalho: assume a janela inteira, sem faixa nem abas (ver App.vue).
    meta: { titulo: 'Editor de prova', telaCheia: true },
  },
  {
    path: '/banco-de-questoes',
    name: 'banco-de-questoes',
    component: () => import('@/telas/BancoDeQuestoes.vue'),
    meta: { titulo: 'Banco de questoes' },
  },
  {
    path: '/turmas',
    name: 'turmas',
    component: () => import('@/telas/Turmas.vue'),
    meta: { titulo: 'Turmas' },
  },
  {
    path: '/turmas/:id',
    name: 'turmas-detalhe',
    component: () => import('@/telas/DetalheDaTurma.vue'),
    meta: { titulo: 'Detalhe da turma' },
  },
  {
    path: '/correcoes',
    name: 'correcoes',
    component: () => import('@/telas/EmConstrucao.vue'),
    meta: { titulo: 'Correcoes' },
  },
  {
    path: '/relatorios',
    name: 'relatorios',
    component: () => import('@/telas/EmConstrucao.vue'),
    meta: { titulo: 'Relatorios' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/provas' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes: rotas,
  scrollBehavior: () => ({ top: 0 }),
});

router.afterEach((para) => {
  const titulo = para.meta.titulo as string | undefined;
  document.title = titulo ? `${titulo} · SGP Católica` : 'SGP Católica';
});
