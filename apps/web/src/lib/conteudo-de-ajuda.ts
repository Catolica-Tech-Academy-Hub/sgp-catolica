/**
 * Conteúdo da tela de ajuda.
 *
 * Não é dado de domínio — não é `Usuario`, `Prova` nem `Turma` — então não entra em
 * `@sgp/mocks`. Também não é documentação da equipe, então não entra em `docs/`: é
 * conteúdo que o usuário final lê **dentro** do produto, e por isso mora aqui, no mesmo
 * formato de `cabecalhos-da-prova.ts`.
 *
 * As respostas descrevem o que o sistema faz hoje. Onde uma função depende de backend, a
 * resposta diz isso com todas as letras, em vez de prometer comportamento que a fase N1
 * não tem.
 */

export interface PerguntaFrequente {
  id: string;
  pergunta: string;
  /** Parágrafos da resposta. Um array, e não uma string, para a tela não interpretar HTML. */
  resposta: string[];
  /** Assunto, usado como agrupador e como alvo de busca. */
  assunto: string;
}

export const assuntosDeAjuda = [
  'Primeiros passos',
  'Provas',
  'Questões',
  'Turmas',
  'Aplicações',
  'Correção e notas',
  'Limites desta fase',
] as const;

export type AssuntoDeAjuda = (typeof assuntosDeAjuda)[number];

export const perguntasFrequentes: PerguntaFrequente[] = [
  {
    id: 'comecar',
    assunto: 'Primeiros passos',
    pergunta: 'Por onde eu começo?',
    resposta: [
      'O caminho mais curto até uma prova pronta é: criar a turma, montar a prova e aplicar a prova à turma.',
      'Turmas guardam os alunos; provas guardam o conteúdo. As duas coisas são independentes de propósito — a mesma prova pode ir para várias turmas depois, sem ser recriada.',
    ],
  },
  {
    id: 'secoes',
    assunto: 'Primeiros passos',
    pergunta: 'O que cada seção faz?',
    resposta: [
      'Provas é o acervo de conteúdo: cada prova é um conjunto de questões com pontuação.',
      'Aplicações é a combinação de uma prova com uma turma — é onde a prova vira uma avaliação concreta, com data e alunos.',
      'Banco de questões guarda questões reutilizáveis entre provas.',
      'Turmas reúne alunos e códigos de convite. Correções é a fila de notas que aguardam um aluno. Relatórios mostra o desempenho do que já foi corrigido.',
    ],
  },
  {
    id: 'prova-vs-aplicacao',
    assunto: 'Provas',
    pergunta: 'Qual a diferença entre uma prova e uma aplicação?',
    resposta: [
      'A prova é o conteúdo: enunciados, alternativas e pontuação. Ela não pertence a nenhuma turma.',
      'A aplicação é essa prova aplicada a uma turma específica. Toda configuração de PDF, gabarito, correção e nota pertence à aplicação, não à prova.',
      'Por isso a mesma prova pode ser aplicada a duas turmas, ou duas vezes à mesma turma numa segunda chamada: as aplicações são independentes entre si e têm notas separadas.',
    ],
  },
  {
    id: 'estados-da-prova',
    assunto: 'Provas',
    pergunta: 'O que significam Rascunho, Pronta e Encerrada?',
    resposta: [
      'Rascunho é a prova ainda em montagem. Pronta é a prova que já foi aplicada pelo menos uma vez — essa passagem acontece sozinha, não há um botão para ela.',
      'Encerrada é a prova arquivada: ela não aceita novas aplicações, mas as aplicações que já existiam continuam valendo e sendo corrigidas. Encerrar não exclui nada.',
    ],
  },
  {
    id: 'limite-de-questoes',
    assunto: 'Provas',
    pergunta: 'Quantas questões uma prova pode ter?',
    resposta: [
      'Até 20 questões, objetivas e discursivas em qualquer combinação.',
      'A pontuação de cada questão é livre e a soma não é validada pelo sistema: se você quer que a prova valha 10, a conferência é sua. O editor mostra o total acumulado para ajudar nisso.',
    ],
  },
  {
    id: 'editor-paginas',
    assunto: 'Provas',
    pergunta: 'Como o editor decide onde quebra a página?',
    resposta: [
      'O editor mede o cabeçalho e cada bloco na largura real do papel A4 e cria uma folha nova quando o conteúdo passa da área útil.',
      'A quebra acontece sempre entre blocos, nunca no meio de uma questão, para o aluno não receber um enunciado partido em duas folhas.',
      'A escala da folha na tela muda só para ela caber na largura disponível; a geometria continua em 210 × 297 mm, então o que você vê é a paginação real.',
    ],
  },
  {
    id: 'salvar-no-banco',
    assunto: 'Questões',
    pergunta: 'Preciso salvar no banco toda questão que eu escrevo?',
    resposta: [
      'Não. Uma questão escrita direto na prova funciona sem nunca passar pelo banco.',
      '"Salvar no banco" serve para reaproveitar a questão em outras provas. E uma questão trazida do banco entra na prova como cópia editável: mexer nela ali não altera o acervo em silêncio.',
    ],
  },
  {
    id: 'excluir-questao',
    assunto: 'Questões',
    pergunta: 'Excluir uma questão do banco apaga ela das provas antigas?',
    resposta: [
      'Não. A exclusão é lógica: a questão sai do banco e deixa de ser oferecida em provas novas, mas as provas que já a usam continuam mostrando o enunciado.',
      'Logo depois de excluir, o aviso na tela oferece "Desfazer".',
    ],
  },
  {
    id: 'codigo-de-convite',
    assunto: 'Turmas',
    pergunta: 'Para que serve o código de convite da turma?',
    resposta: [
      'Toda turma nasce com um código único. Ele é o caminho para o aluno se matricular sozinho, sem você cadastrar cada um.',
      'Você pode regenerar o código quando quiser; o anterior deixa de valer imediatamente, o que é útil se ele circulou fora da turma.',
    ],
  },
  {
    id: 'remover-aluno',
    assunto: 'Turmas',
    pergunta: 'Remover um aluno da turma apaga as notas dele?',
    resposta: [
      'Não. A remoção tira o aluno da lista da turma e preserva o histórico de notas — inclusive para os relatórios da turma continuarem corretos.',
      'Arquivar a turma inteira segue a mesma ideia: as aplicações existentes não são apagadas.',
    ],
  },
  {
    id: 'aplicar-a-turma',
    assunto: 'Aplicações',
    pergunta: 'Como eu aplico uma prova a uma turma?',
    resposta: [
      'No editor da prova, em "Aplicar a uma turma", escolha uma turma ativa. A aplicação nasce como rascunho.',
      'A mesma prova pode ser aplicada de novo à mesma turma quantas vezes for preciso; cada aplicação tem suas próprias notas.',
    ],
  },
  {
    id: 'identificacao',
    assunto: 'Aplicações',
    pergunta: 'Prova com ou sem identificação do aluno: qual a diferença?',
    resposta: [
      'Com identificação, cada aluno recebe uma folha com o nome impresso e um QR Code próprio. O aplicativo reconhece de quem é a prova e a nota é atribuída sozinha.',
      'Sem identificação, a prova é anônima: o QR Code diz apenas qual versão é aquela. O aplicativo calcula a nota, mas quem ela é fica para você decidir na seção Correções.',
    ],
  },
  {
    id: 'fila-de-correcoes',
    assunto: 'Correção e notas',
    pergunta: 'Por que uma nota aparece em Correções sem aluno?',
    resposta: [
      'Porque aquela prova foi gerada sem identificação. O aplicativo leu a versão, conferiu o cartão-resposta e calculou a nota, mas não tem como saber de quem é a folha.',
      'Em Correções você associa cada nota a um aluno matriculado na turma daquela aplicação. A busca já vem preenchida com o nome que foi lido na folha, e aceita nome abreviado.',
      'Atribuir preenche o aluno na correção que já existe — não cria uma segunda nota. E o mesmo aluno não pode receber duas correções da mesma versão da prova.',
    ],
  },
  {
    id: 'errei-a-atribuicao',
    assunto: 'Correção e notas',
    pergunta: 'Atribuí a nota ao aluno errado. Como desfaço?',
    resposta: [
      'O aviso que aparece depois de atribuir oferece "Desfazer": a correção volta para a fila de pendentes e pode ser atribuída a outro aluno.',
    ],
  },
  {
    id: 'relatorio-vazio',
    assunto: 'Correção e notas',
    pergunta: 'Por que minha aplicação não aparece nos relatórios?',
    resposta: [
      'O relatório só considera nota já atribuída a um aluno. Uma aplicação corrigida sem identificação fica fora até você passar pela fila de Correções.',
      'Se a aplicação ainda não tem nenhuma nota atribuída, ela não aparece — em vez de mostrar média zero, que descreveria mal uma turma que só ainda não foi corrigida.',
    ],
  },
  {
    id: 'onde-esta-o-qr',
    assunto: 'Limites desta fase',
    pergunta: 'Onde eu leio o QR Code e corrijo a prova?',
    resposta: [
      'A leitura de QR Code e de cartão-resposta é exclusiva do aplicativo do professor. Ela não existe e não vai existir na web: a câmera sobre a folha é um gesto de celular.',
      'A web cuida de criar, aplicar, lançar nota manualmente e ver relatórios.',
    ],
  },
  {
    id: 'sem-backend',
    assunto: 'Limites desta fase',
    pergunta: 'Por que alguns botões estão desabilitados?',
    resposta: [
      'Esta é uma versão para demonstração das telas: ela não conversa com servidor nenhum. Gerar PDF, exportar relatório, Integrações e enviar mensagem de suporte dependem do backend, que entra em uma fase seguinte.',
      'Em vez de mostrar um botão que parece funcionar e não faz nada, esses controles ficam desabilitados com a explicação do motivo.',
    ],
  },
  {
    id: 'meus-dados-somem',
    assunto: 'Limites desta fase',
    pergunta: 'O que eu crio aqui fica salvo?',
    resposta: [
      'O que você cria fica guardado no seu próprio navegador, então sobrevive a recarregar a página e a fechar a aba.',
      'Mas não é um banco de dados: não sai deste computador, não aparece para mais ninguém e limpar os dados do navegador apaga tudo. Nada do que está aqui é sincronizado.',
    ],
  },
  {
    id: 'login-real',
    assunto: 'Limites desta fase',
    pergunta: 'Minha senha está sendo verificada?',
    resposta: [
      'Não. A tela de entrada só confere o formato do e-mail e o tamanho da senha antes de abrir o protótipo. Não há autenticação, token nem sessão, e por isso "Sair" também apenas avisa que a função ainda não existe.',
      'Nenhuma senha digitada aqui é enviada ou armazenada.',
    ],
  },
];

/** Canais de contato. Sem backend, a tela os exibe como informação, não como envio. */
export const canaisDeContato = [
  {
    id: 'coordenacao',
    titulo: 'Coordenação do curso',
    descricao: 'Dúvidas sobre turmas, prazos e uso do sistema na disciplina.',
  },
  {
    id: 'suporte-tecnico',
    titulo: 'Suporte técnico',
    descricao: 'Erro na tela, comportamento inesperado ou dificuldade de acesso.',
  },
] as const;
