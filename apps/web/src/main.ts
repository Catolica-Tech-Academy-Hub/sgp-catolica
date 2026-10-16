import { createApp } from 'vue';
import { toast } from 'vue-sonner';
import './styles/global.css';
import App from './App.vue';
import { router } from './router';
import { apiLigada } from './lib/api';
import { carregarQuestoesDoServidor } from './lib/estado-de-questoes';
import { carregarTurmasDoServidor } from './lib/estado-de-turmas';

/**
 * Com a API ligada, os dados chegam antes de montar: as telas leem o estado de forma
 * síncrona e uma rota aberta direto (F5 em `/turmas/:id`) não pode encontrar o acervo
 * vazio e concluir que a turma não existe.
 */
async function carregarDoServidor(): Promise<void> {
  if (!apiLigada) return;
  try {
    await Promise.all([carregarTurmasDoServidor(), carregarQuestoesDoServidor()]);
  } catch (erro) {
    console.error(erro);
    // O Toaster ainda não está montado; o aviso entra depois que a casca existir.
    window.setTimeout(() => {
      toast.error('Não foi possível carregar os dados do servidor', {
        description: 'Confira se a API está rodando e recarregue a página.',
      });
    });
  }
}

void carregarDoServidor().then(() => {
  createApp(App).use(router).mount('#app');
});
