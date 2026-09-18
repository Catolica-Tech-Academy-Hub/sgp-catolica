import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import Provas from '@/telas/Provas.vue';

/**
 * Rotas da aplicacao web.
 *
 * Dois grupos: a perspectiva do professor, que usa a casca com abas de secao, e a do
 * estudante, marcada com `meta.casca: 'estudante'`. `meta.telaCheia` dispensa a casca
 * inteira e e usada pelo login e pelo editor de prova.
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
    path: '/aplicacoes',
    name: 'aplicacoes',
    component: () => import('@/telas/Aplicacoes.vue'),
    meta: { titulo: 'Aplicações' },
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
    component: () => import('@/telas/Correcoes.vue'),
    meta: { titulo: 'Correcoes' },
  },
  {
    path: '/relatorios',
    name: 'relatorios',
    component: () => import('@/telas/Relatorios.vue'),
    meta: { titulo: 'Relatorios' },
  },
  // --- Perspectiva do estudante (RF11) ---
  // Grupo separado do professor de propósito: `meta.casca` escolhe a casca enxuta, sem
  // as abas de Provas/Turmas/Correções, que não pertencem ao aluno.
  {
    path: '/estudante',
    name: 'estudante-historico',
    component: () => import('@/telas/estudante/Historico.vue'),
    meta: { titulo: 'Minhas notas', casca: 'estudante' },
  },
  {
    path: '/suporte',
    name: 'suporte',
    component: () => import('@/telas/Suporte.vue'),
    meta: { titulo: 'Ajuda' },
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
