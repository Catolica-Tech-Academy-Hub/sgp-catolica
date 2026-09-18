# Experiência web atual

## Escopo e situação

Este documento descreve a aplicação web executável na N1. Ele registra o que o docente
consegue fazer hoje, o que é apenas demonstrativo e o que ainda depende de requisitos ou
backend. Regras visuais ficam no [design system web](design-system-web.md).

Classificação usada:

- **Implementado na N1:** fluxo navegável e estado local suficiente para demonstração.
- **Marcador:** rota ou controle visível sem funcionalidade de produto.
- **Protótipo em avaliação:** interação implementada para validar uma proposta que ainda
  não foi incorporada ao domínio aprovado.

## Mapa de navegação

| Rota                 | Situação               | Experiência atual                                                                   |
| -------------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| `/`                  | Implementado           | Redireciona para `/login`.                                                          |
| `/login`             | Implementado na N1     | Escolha de papel, valida o formato e abre a perspectiva escolhida; não autentica.   |
| `/provas`            | Implementado na N1     | Workspace para buscar, filtrar, ordenar, abrir e criar provas.                      |
| `/provas/:id`        | Protótipo em avaliação | Editor A4 em tela cheia, autoria por blocos, aplicação em turma e pré-visualização. |
| `/aplicacoes`        | Implementado na N1     | Lista aplicações por prova e turma; detalhe somente leitura das versões existentes. |
| `/banco-de-questoes` | Implementado na N1     | Tela dedicada: criar, editar, buscar, filtrar por tipo e excluir com desfazer.      |
| `/turmas`            | Implementado na N1     | Workspace para buscar, filtrar e criar turmas.                                      |
| `/turmas/:id`        | Implementado na N1     | Detalhe da turma: editar, arquivar, código de convite e matrículas.                 |
| `/correcoes`         | Implementado na N1     | Fila de atribuição manual de nota (RF09), com busca, filtros e detalhe da regra.    |
| `/relatorios`        | Implementado na N1     | Relatório por aplicação e consolidado, com filtros e exportação desabilitada.       |
| `/suporte`           | Implementado na N1     | Perguntas frequentes com busca e contato; envio depende de backend.                 |
| `/estudante`         | Implementado na N1     | Histórico de notas do aluno logado, em casca própria sem abas.                      |
| Rota desconhecida    | Implementado           | Redireciona para `/provas`.                                                         |

As seções de domínio aparecem nas abas para tornar a arquitetura do produto visível sem
simular funções prontas. Login e editor usam `meta.telaCheia`; as demais rotas usam a
casca autenticada.

## Login

### Composição

Em desktop, a janela é dividida em dois painéis:

- à esquerda, fundo aubergine, marca, chamada “Provas mais simples de criar, aplicar e
  acompanhar”, ilustração de preparação de prova e identificação de ambiente
  demonstrativo;
- à direita, superfície branca com seletor de idioma visual e formulário centralizado.

A ilustração possui movimento vertical discreto e é estática quando o sistema solicita
redução de movimento. Em largura inferior a `lg`, o painel visual é removido e a marca
aparece no cabeçalho do formulário.

### Comportamento

1. O docente informa e-mail e senha.
2. O navegador exige `@` no e-mail e pelo menos oito caracteres na senha.
3. Em erro, a mensagem aparece com `role="alert"` e o campo recebe `aria-invalid`.
4. Com dados formalmente válidos, a navegação segue para `/provas`.

Não há sessão, JWT, consulta à API, recuperação de senha ou validação real de credenciais.
O próprio formulário informa esse limite.

## Casca autenticada

A casca tem uma barra branca externa e uma moldura cinza arredondada:

| Região      | Conteúdo                                                               | Situação                                                   |
| ----------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| Marca       | Ícone e “SGP Católica”, com link para Provas.                          | Funcional.                                                 |
| Integrações | Botão na barra externa.                                                | Marcador sem ação.                                         |
| Ajuda       | Botão apenas com ícone.                                                | Marcador sem ação.                                         |
| Perfil      | Nome/e-mail do mock e ação “Sair”.                                     | Menu funciona; sair apenas informa que falta autenticação. |
| Abas        | Provas, Aplicações, Banco de questões, Turmas, Correções e Relatórios. | Navegação funcional; nenhum destino é marcador.            |
| Moldura     | Abas e página sobre o mesmo campo cinza.                               | Funcional e responsiva.                                    |

As abas rolam horizontalmente em tela estreita sem mostrar uma barra de rolagem. A
aplicação mantém o atalho “Ir para o conteúdo”.

## Workspace de Provas

### Entrada e carregamento

Ao abrir `/provas`, o conteúdo mostra skeletons por aproximadamente 350 ms e depois lê o
acervo local, inicialmente semeado pelos mocks.

### Painel esquerdo

O painel reúne:

1. botão **Nova prova**;
2. busca por título ou descrição;
3. identificação “Meu espaço” com total;
4. filtros Todas, Rascunho, Pronta e Encerrada, cada um com sua contagem;
5. total de aplicações registradas no rodapé em desktop.

Os números pertencem aos filtros; não existem cartões de métrica separados.

### Lista

- O cabeçalho do conteúdo mostra “Meu espaço”, descrição e ordenação por data ou título.
- Cada prova é um cartão compacto com título, descrição, situação, questões, pontos,
  aplicações e data em desktop.
- O cartão inteiro é o link para o editor; não há menu concorrente dentro da linha.
- Em largura inferior a `lg`, metadados secundários são ocultados e o título permanece.
- Sem resultado, o estado vazio oferece limpar filtros ou criar a primeira prova.

### Criar e abrir

**Nova prova** cria um rascunho sem título e navega diretamente para `/provas/:id`. Não
existe diálogo intermediário. Abrir um cartão leva ao mesmo editor, onde consulta e edição
acontecem juntas.

## Turmas

### Listagem (`/turmas`)

Mesmo padrão de seção do workspace de provas: skeletons por aproximadamente 350 ms e
depois o acervo local, semeado pelos mocks.

O painel esquerdo reúne:

1. botão **Nova turma**;
2. busca por nome ou disciplina;
3. filtros Todas, Ativa e Arquivada, cada um com sua contagem;
4. total de alunos matriculados no rodapé em desktop.

Cada turma é um cartão compacto com nome, disciplina, período, código de convite,
situação e total de alunos matriculados em desktop; em largura inferior a `lg`, os
metadados secundários são ocultados e o cartão inteiro continua sendo o link para o
detalhe. Sem resultado, o estado vazio oferece limpar filtros ou criar a primeira turma.

**Nova turma** cria a turma sem nome, disciplina ou período e navega direto para
`/turmas/:id`, mesmo padrão de `Provas.vue`: não existe diálogo intermediário, o
preenchimento acontece no detalhe.

### Detalhe (`/turmas/:id`)

A tela fica dentro da casca autenticada, com a aba "Turmas" ativa — por isso usa um
link "Turmas" para voltar em vez de breadcrumb.

O cabeçalho mostra nome, disciplina, período e situação (`Badge`), com as ações:

- **Editar**: abre um `Dialog` com nome, disciplina e período; valida os três campos
  antes de salvar;
- **Arquivar**: muda a situação para arquivada sem apagar as aplicações existentes;
  desabilitada quando a turma já está arquivada. Não há ação para reverter.

O código de convite aparece em destaque, com **Regenerar**: gera um novo código local,
invalida o anterior e confirma por toast.

A lista de alunos matriculados usa `Table` em `Card`, porque os registros são
comparados por coluna (nome, e-mail, matrícula, data de matrícula) — não lista de
cartões. Cada linha tem uma ação **Remover** que tira o aluno da turma sem apagar seu
histórico de notas; a remoção é reversível por toast com **Desfazer**. Sem alunos, o
estado vazio explica que a entrada acontece pelo código de convite, sem oferecer ação
de matricular — esse fluxo depende de autenticação real de estudante, fora da N1 web.

## Editor de prova

O editor ocupa a janela inteira e substitui a casca. É um protótipo em avaliação porque
os blocos de apoio e modelos de cabeçalho ampliam o formato mínimo de `Prova` definido em
RF04. A projeção das questões para `Prova.questions` continua preservada.

### Barra do editor

Da esquerda para a direita:

- breadcrumb `Provas › título`, com link para o acervo;
- título editável no lugar;
- situação da prova;
- contador de até 20 questões, total de pontos e indicação de salvamento local;
- **Pré-visualizar**;
- **Aplicar a uma turma**, que abre um diálogo com as turmas ativas e cria uma aplicação
  local em `draft`. A mesma prova pode ser aplicada novamente à mesma turma.

## Aplicações

`/aplicacoes` usa o padrão de seção com painel esquerdo, busca, recortes por situação e
lista de cartões. Cada cartão mostra prova, turma, situação, versões e data, e abre um
`Dialog` somente leitura com as versões já presentes nos mocks: número, embaralhamento,
publicação do gabarito e código público.

Aplicações novas ficam em `draft` e são preservadas no navegador. O detalhe mantém
**Gerar PDF** desabilitado com a explicação de que a geração pertence ao RF06; nenhuma
ação desta tela cria versão, QR Code ou atribuição.

### Três zonas

| Zona      | Comportamento                                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Estrutura | Grupos “Página N” espelham as folhas calculadas. Página 1 contém o cabeçalho; cada grupo lista seus blocos. Selecionar rola a folha e setas movem o bloco.                                                                                 |
| Folha     | Sequência centralizada de páginas A4 de 210 × 297 mm e margem de 16 mm. A escala visual se ajusta à largura do canvas, sem barra horizontal; o conteúdo continua medido na geometria real e distribuído automaticamente sem partir blocos. |
| Contexto  | Painel de 320 px que alterna entre propriedades, criação de conteúdo e banco sem mudar a largura da folha.                                                                                                                                 |

Em tela menor que `lg`, as zonas passam para disposição vertical.

Quando a prova está pronta ou encerrada, um aviso aparece no topo da folha: para uma prova
pronta, informa que já há aplicações geradas e que mudar as questões não altera PDFs já
emitidos; para uma prova encerrada, informa que ela não aceita novas aplicações, mas o
conteúdo continua editável normalmente. Nos dois casos, a edição não é bloqueada.

## Autoria de questões

### Criar diretamente na prova

**Nova questão** abre o painel “Adicionar à prova”. As opções principais são:

| Tipo             | Estado inicial                                  | Edição                                                                             |
| ---------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| Múltipla escolha | Enunciado vazio, quatro alternativas e 1 ponto. | Enunciado e alternativas na folha; resposta correta por radio; 2 a 5 alternativas. |
| Resposta curta   | Enunciado vazio, 1 ponto e quatro linhas.       | Enunciado na folha; tipo e pontuação no painel.                                    |
| Resposta longa   | Enunciado vazio, 1 ponto e oito linhas.         | Enunciado na folha; tipo e pontuação no painel.                                    |

O bloco entra depois do selecionado; sem seleção, entra no fim. A numeração considera
somente questões e é recalculada pela ordem da folha.

Após cada mudança de enunciado, alternativa, tipo, imagem ou ordem, o editor mede os
blocos na largura real do A4. Quando o próximo bloco não cabe na área útil, ele começa na
folha seguinte. O cabeçalho completo fica na primeira página e cada folha recebe sua
numeração na margem inferior. Quando as sidebars reduzem o espaço central, o papel é
apenas escalado visualmente e permanece centralizado; a medida usada para quebrar páginas
não muda.

Os botões **Nova questão** e **Banco de questões** permanecem em uma barra flutuante na
base do canvas, sempre acessível enquanto as folhas rolam. A barra fica fora do papel,
não cria página vazia e não aparece no preview. Quando a paginação muda, os mesmos grupos
“Página N” são atualizados na estrutura.

O tipo pode ser trocado no painel de propriedades. Múltipla escolha exige resposta única,
coerente com `correctAlternativeId` no domínio atual. A alternativa correta aparece
durante a autoria e no resumo do painel, mas não aparece na pré-visualização do aluno.

### Salvar no banco

O painel da questão oferece **Salvar no banco** ou **Atualizar no banco**.

- discursiva exige enunciado;
- objetiva exige enunciado, pelo menos duas alternativas preenchidas e uma correta;
- a questão continua na prova após salvar;
- salvar o mesmo id atualiza a entrada local em vez de criar duplicata;
- o banco é local ao navegador nesta fase.

### Usar o banco

**Banco de questões** abre um painel independente com busca, filtro por objetiva ou
discursiva, tags e ação de adicionar. Questões locais aparecem junto dos mocks.

Ao entrar na prova, a questão do banco vira uma cópia editável. Alterações feitas na folha
não atualizam o acervo automaticamente; o professor precisa escolher **Atualizar no
banco**. Uma questão já presente na prova não pode ser adicionada novamente pelo painel.

## Conteúdo de apoio

O mesmo painel de inserção apresenta uma seção secundária de apoios:

| Apoio              | Edição                                   | Impressão                                   |
| ------------------ | ---------------------------------------- | ------------------------------------------- |
| Título de seção    | Título e descrição diretamente na folha. | Organiza partes; não altera embaralhamento. |
| Texto ou instrução | Texto na folha; estilo no painel.        | Parágrafo, instrução lateral ou destaque.   |
| Imagem             | Arquivo local e legenda na folha.        | Imagem e legenda, sem upload para servidor. |

Esses blocos não recebem número nem pontuação. O antigo bloco isolado de espaço para
resposta ainda é lido de estados locais anteriores, mas não pode ser criado pelo fluxo
novo; áreas de resposta pertencem às questões discursivas.

## Seleção e ações de bloco

- Clicar ou focar um bloco seleciona-o e abre suas propriedades.
- O selecionado recebe ring e barra contextual com mover, duplicar e excluir.
- Mover preserva a seleção por id.
- Duplicar cria um novo id; em questões também cria nova identidade de banco.
- Excluir mostra toast com **Desfazer** e restaura o bloco na posição anterior.
- A estrutura esquerda mantém mover para cima/baixo como alternativa acessível.

## Cabeçalho da prova

Selecionar o cabeçalho abre suas propriedades:

- instituição;
- curso, disciplina ou período;
- professor;
- descrição da prova;
- instruções;
- campos opcionais Nome, Matrícula, Turma, Data e Nota;
- seleção e criação de modelos reutilizáveis.

O marcador de QR é padrão e sempre aparece. Não há configuração para escondê-lo. Ele é
apenas uma reserva visual; o QR válido com dados de aplicação só existe quando RF06 for
implementado.

Modelos de cabeçalho são salvos localmente e podem ser aplicados a outras provas no mesmo
navegador.

## Pré-visualização

**Pré-visualizar** abre um modo imersivo inspirado na apresentação do Figma:

1. o editor sai de cena e um canvas pontilhado ocupa a janela;
2. a mesma folha A4 aparece centralizada e somente leitura;
3. enunciados, alternativas, áreas de resposta, cabeçalho e apoios usam os mesmos
   renderizadores do editor;
4. as quebras de página são exatamente as calculadas no editor;
5. seleção, inputs, ações de bloco e gabarito são removidos;
6. a barra inferior oferece zoom de 40% a 140% e **Ajustar**;
7. o modo fecha pelo botão superior ou por `Escape`.

A prévia não gera PDF nem cria uma aplicação.

## Estado e persistência da N1

Não há backend. O navegador usa três chaves independentes:

| Chave                        | Conteúdo                                      |
| ---------------------------- | --------------------------------------------- |
| `sgp:estado-de-provas:v1`    | Provas e blocos de autoria.                   |
| `sgp:cabecalhos-da-prova:v1` | Cabeçalhos por prova e modelos reutilizáveis. |
| `sgp:questoes-locais:v1`     | Questões salvas ou atualizadas pelo editor.   |
| `sgp:estado-de-turmas:v1`    | Turmas e matrículas.                          |

Os mocks semeiam provas, questões, aplicações e turmas. Recarregar a página preserva o
estado local, mas outro dispositivo ou navegador não recebe essas alterações. O tooltip
de salvamento no editor informa esse limite.

## Estados e feedback

| Situação                             | Implementação                                              |
| ------------------------------------ | ---------------------------------------------------------- |
| Carregando                           | Skeleton no workspace e no editor.                         |
| Prova inexistente                    | Mensagem e link para o acervo.                             |
| Lista sem resultado                  | Explicação e limpar filtros ou criar prova.                |
| Limite de 20 questões                | Ações de questão desabilitadas e mensagem na folha/painel. |
| Bloco removido                       | Toast com Desfazer.                                        |
| Salvamento de modelo/questão         | Toast de sucesso.                                          |
| Turma sem resultado na busca         | Explicação e limpar filtros ou criar turma.                |
| Turma inexistente                    | Mensagem e link para o acervo.                             |
| Turma sem alunos matriculados        | Explicação; sem ação, matricular é fora de escopo.         |
| Matrícula removida                   | Toast com Desfazer.                                        |
| Código de convite regenerado         | Toast de sucesso.                                          |
| Aplicar, Integrações, Ajuda e logout | Desabilitado ou feedback que explicita a fase.             |

## Acessibilidade implementada

- atalho “Ir para o conteúdo”;
- regiões principais e navegações nomeadas;
- `aria-current` nas abas e `aria-pressed` em filtros/seleções;
- labels para campos e nomes acessíveis para botões apenas com ícone;
- ícones decorativos ocultos de leitores de tela;
- ações de reordenação por botão, sem depender de arrastar;
- foco contido e saída por `Escape` na pré-visualização;
- movimento do login desativado por `prefers-reduced-motion`.

## Correções

### O que a tela resolve

`/correcoes` é a fila de **atribuição manual de nota** (RF09). A leitura de QR Code e de
cartão-resposta pertence exclusivamente ao aplicativo do professor (RF08) e não tem
equivalente na web.

O caso que chega aqui é o da prova gerada **sem identificação do aluno**: o aplicativo
leu a versão pelo QR Code, conferiu o cartão e calculou a nota, mas não sabe de quem ela
é. O professor associa cada correção a um aluno matriculado, a partir do nome e da
matrícula que o aplicativo leu na folha.

### Composição

| Região          | Conteúdo                                                                         |
| --------------- | -------------------------------------------------------------------------------- |
| Painel esquerdo | Busca por nome/matrícula informados e recorte por situação, com contagem.        |
| Cabeçalho       | Título, explicação e `Select` de aplicação.                                      |
| Conteúdo        | `Table` em `Card`: aluno informado, prova e turma, versão, nota, data, situação. |

Os registros são comparados coluna a coluna, por isso tabela e não lista de cartões. O
filtro de aplicação fica no cabeçalho, e não como recorte do painel: a mesma prova pode
ir duas vezes para a mesma turma (segunda chamada, RF05), então o rótulo precisa carregar
prova, turma **e** data, o que os 256 px do painel truncariam justamente no que distingue
as duas.

### Atribuição

“Atribuir” abre um `Dialog` com a nota calculada e a lista dos alunos **matriculados na
turma daquela aplicação** — nunca a base inteira de estudantes.

- a busca vem pré-preenchida com o nome lido na folha, como RF09 pede;
- a comparação tolera nome abreviado: a folha traz “Clara A.” onde a matrícula diz
  “Clara Antunes”, e uma busca por substring falharia exatamente no caso que ela existe
  para resolver;
- aluno que já tem nota naquela versão aparece desabilitado, com o motivo ao lado: RF09
  proíbe duas correções da mesma versão para o mesmo aluno;
- confirmar **preenche o vínculo na correção existente**, sem criar registro novo, para
  não duplicar a nota em relatório e exportação;
- o toast de sucesso oferece “Desfazer”, que é a única forma de corrigir uma escolha
  errada: sem ele, a correção sairia da fila sem caminho de volta.

Quando a correção já tem aluno, a linha mostra o nome real e a marca “Atribuída”, sem
ação.

### Estado

`src/lib/estado-de-correcoes.ts` segue o formato dos demais `estado-*`: reativo, semeado
por `correcoesMock`, gravado em `localStorage` e ponto único de integração quando o
backend existir.

## Relatórios

### Os dois modos

`/relatorios` atende o RF10 em dois recortes, escolhidos no painel esquerdo:

- **Por aplicação**: cartões de média, mediana e desvio padrão, gráfico de distribuição
  das notas por faixa e a lista de alunos avaliados com a nota de cada um;
- **Consolidado**: gráfico de média por aplicação e tabela com uma linha por aplicação do
  recorte (prova, turma, disciplina, média, mediana, avaliados).

Os filtros de turma, disciplina e período valem para os dois. Trocar um filtro que
esconda a aplicação escolhida reaponta a seleção para a primeira da lista, em vez de
deixar a tela num alvo que não está mais visível.

### De onde vêm os números

As estatísticas são **derivadas das correções** em `@sgp/mocks`, não digitadas. A média
do cartão e as notas listadas logo abaixo saem do mesmo cálculo, então não há como
divergirem. Só entra no relatório a nota já atribuída a um aluno: correção pendente de
atribuição manual (RF09) ainda não tem dono e não pode contar como nota da turma.

A aplicação sem nenhuma nota atribuída não aparece — um cartão de zeros descreveria mal
uma turma que simplesmente ainda não foi corrigida. O estado vazio explica isso e leva
para Correções.

### Exportação

CSV, Excel e PDF são requisito do RF10, mas dependem de backend: os três botões ficam
desabilitados com Tooltip explicando o limite, no mesmo padrão de Integrações e da
geração de PDF. Nenhum arquivo é gerado.

## Perspectiva do estudante

O produto tem duas perspectivas na web: o espaço de trabalho do professor e o histórico
do estudante. Até aqui só a primeira existia, e RF11 não tinha por onde entrar.

### Entrada

O login ganhou a escolha de papel ("Sou professor" / "Sou estudante") acima dos campos,
com a mesma validação de formato para os dois. O papel decide o destino: `/provas` ou
`/estudante`. O placeholder do e-mail acompanha o papel, porque RF01 separa os domínios
(`@catolicasc.org.br` para professor, `@catolicasc.edu.br` para estudante).

A escolha **não é autorização**. Sem backend, ela só abre uma das duas perspectivas, e o
texto abaixo do formulário diz isso: "o papel escolhido decide qual perspectiva abre, não
o que você pode ver".

### Casca do estudante

Mesma moldura, casca mais enxuta: a barra externa tem marca, Ajuda e perfil, e **não há
fileira de abas**. RF11 dá ao aluno uma única área — o próprio histórico — e uma aba
sozinha seria moldura sem função.

`BarraSuperior` é a mesma dos dois lados, configurada por props (quem está logado, para
onde a marca leva, se Integrações aparece). Duas barras separadas fariam toda mudança
visual precisar ser feita duas vezes, e uma delas seria esquecida. Integrações não
aparece para o aluno: ele não tem o que integrar.

A rota usa `meta.casca: 'estudante'`, que é o que `App.vue` lê para escolher a casca.

### Isolamento

O "isolamento total" de RF11 é regra de backend. Aqui o aluno logado é sempre
`estudanteLogadoMock` e as notas exibidas são as dele; não existe forma de trocar de
aluno pela interface. É o mais honesto possível sem autenticação: nada finge autorizar.

## Ajuda

`/suporte` responde o que o botão "Ajuda" da barra superior prometia e não cumpria. Não
corresponde a nenhum RF — é utilitário de produto, não requisito do cliente.

A rota fica **dentro da casca autenticada, mas fora das abas**: as abas são as seções de
domínio, e misturar uma utilidade entre elas competiria com o trabalho. O acesso é pelo
ícone da barra externa, que é onde o usuário já procura ajuda.

| Região          | Conteúdo                                                               |
| --------------- | ---------------------------------------------------------------------- |
| Painel esquerdo | Busca na ajuda e recorte por assunto, com contagem.                    |
| Conteúdo        | Perguntas frequentes em `Accordion`, e o cartão "Falar com o suporte". |

A busca cobre pergunta, resposta e assunto — quem procura "QR Code" não sabe em qual
assunto ele está — e **abre as respostas que casaram**, em vez de devolver uma lista de
títulos fechados. Limpar a busca fecha tudo de volta.

O formulário de contato existe com os campos desabilitados e a explicação de que o envio
depende de backend, no mesmo padrão de Integrações e da exportação. Os canais de contato
aparecem ao lado como informação.

### Onde o conteúdo vive

Em `src/lib/conteudo-de-ajuda.ts`. Não é dado de domínio, então não entra em
`@sgp/mocks`; não é documentação da equipe, então não entra em `docs/`. É conteúdo que o
usuário final lê dentro do produto.

As respostas descrevem o comportamento real, incluindo os limites: que a persistência é
só do navegador, que a senha não é verificada e que a leitura de QR Code é exclusiva do
aplicativo. A tela de ajuda é o lugar mais barato de ser honesto sobre a fase.

## Limites e próximos passos

- autenticação, logout e Integrações não estão conectados;
- o formulário de contato da Ajuda não envia: sem servidor, não há para onde mandar;
- matricular aluno por e-mail ou por código de convite (fluxo de entrada do estudante)
  fica fora de Turmas: não há autenticação nem sessão de estudante na N1 web;
- importar lista de alunos por planilha em Turmas depende de um pedido do cliente
  ainda não incorporado como critério de aceite — ver
  [pendências](../pendencias.md), item 12;
- geração de versões, QR válido e PDF dependem de RF06; a aplicação local de uma prova
  em uma turma já está disponível como fluxo N1 de RF05;
- blocos excepcionalmente maiores que uma área útil de A4 ainda precisam de tratamento
  específico na futura geração de PDF;
- o modelo de blocos precisa de decisão da
  [issue #12](https://github.com/LeoAnders/sgp-catolica/issues/12) antes de migrar para
  `@sgp/shared-types` e para o dicionário de entidades;
- persistência local deve ser substituída pelas APIs correspondentes nas próximas fases.
