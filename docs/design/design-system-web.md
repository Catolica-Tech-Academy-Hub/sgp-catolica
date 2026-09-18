# Design system web — SGP Católica

## Papel deste documento

Esta é a fonte normativa de UI da aplicação em `apps/web`. Ela consolida a linguagem
visual construída na N1 e deve orientar novas telas, revisões e componentes. O código em
execução é a referência técnica; divergências entre código e documento devem ser
corrigidas na mesma entrega.

O sistema adota princípios observados no workspace do Typeform — densidade compacta,
hierarquia por superfícies e navegação clara — sem copiar marca, logotipo, textos ou
componentes proprietários. A identidade institucional futura deve ser aplicada pelos
tokens globais, sem reescrever as telas.

## Princípios

1. **A tarefa ocupa o centro.** Navegação e ferramentas permanecem discretas para que o
   conteúdo seja o elemento dominante.
2. **Superfície comunica hierarquia.** Branco externo, campo cinza, cartões e papel têm
   funções distintas; não transformar toda área em cartão.
3. **Densidade calma.** Texto entre 12 e 14 px na operação cotidiana, controles de 32 ou
   40 px e espaços regulares evitam a aparência inflada da versão anterior.
4. **Ação no contexto.** Filtros ficam junto da lista; propriedades ficam junto do bloco;
   mover, duplicar e excluir aparecem quando o bloco é selecionado.
5. **Autoria fiel ao resultado.** Na prova, o professor edita enunciado, alternativas e
   conteúdo sobre a própria folha. Configurações ficam no painel lateral.
6. **Protótipo honesto.** Ações sem backend são desabilitadas ou explicadas. Persistência
   local nunca é apresentada como sincronização real.

## Fundação técnica

| Tema        | Padrão                                                                            |
| ----------- | --------------------------------------------------------------------------------- |
| Framework   | Vue 3, Vite e TypeScript.                                                         |
| Estilos     | Tailwind CSS v4 e tokens CSS em `src/styles/global.css`.                          |
| Componentes | shadcn-vue sobre Reka UI, em `src/components/ui`.                                 |
| Tipografia  | Instrument Sans Variable, com `system-ui` como fallback.                          |
| Ícones      | `@lucide/vue`; traço simples, normalmente 14 ou 16 px.                            |
| Feedback    | `vue-sonner`, por um `Toaster` único na raiz.                                     |
| Tema        | Claro é canônico na N1. Tokens escuros são preservados, mas não há troca exposta. |

Usar os primitivos instalados. Não recriar manualmente Button, Input, Textarea, Select,
Switch, Dialog, DropdownMenu, Card, Table, Alert, Badge, Tooltip ou Skeleton.

## Cor e superfícies

A paleta atual é provisória: aubergine escuro nas ações, cinza levemente violeta no campo
de trabalho, branco nas superfícies e texto quase preto. Cores literais não pertencem às
telas; toda cor deve vir de token semântico.

| Papel             | Token/classe                   | Uso                                                              |
| ----------------- | ------------------------------ | ---------------------------------------------------------------- |
| Margem externa    | `background` / `bg-background` | Barra superior, controles e espaço branco ao redor da aplicação. |
| Campo de trabalho | `field` / `bg-field`           | Moldura cinza, canvas do editor e fundo da pré-visualização.     |
| Objeto elevado    | `card` / `bg-card`             | Linhas de lista, painéis contextuais, estados vazios.            |
| Sobreposição      | `popover` / `bg-popover`       | Dialog, select, dropdown e tooltip.                              |
| Papel             | `sheet` / `bg-sheet`           | Folha A4, sempre branca inclusive no tema escuro.                |
| Tinta do papel    | `sheet-foreground`             | Todo texto impresso.                                             |
| Contorno do papel | `sheet-border`                 | Linhas de resposta, divisórias e limite da folha.                |
| Ação principal    | `primary`                      | Botão primário, indicador ativo e foco.                          |
| Seleção discreta  | `accent` e `secondary`         | Hover, recorte ativo e ícones auxiliares.                        |
| Remoção/erro      | `destructive`                  | Excluir, erro de formulário e falha; nunca ação comum.           |

### Regras de superfície

- A casca autenticada tem fundo branco e uma única moldura cinza arredondada.
- Cartões brancos representam objetos ou estados; não envolvem páginas inteiras sem
  necessidade.
- Borda fina é o separador padrão. Sombras são discretas e reservadas a papel e barras
  flutuantes.
- A folha usa somente tokens `sheet`; o tema da aplicação não muda a aparência impressa.
- Não usar degradê em cartões, métricas, painéis ou cabeçalhos.

## Tipografia

| Uso                     | Tamanho e peso          | Regra                                         |
| ----------------------- | ----------------------- | --------------------------------------------- |
| Texto operacional       | 14 px, 400              | Padrão de campos, listas e parágrafos curtos. |
| Controle compacto       | 13 px, 500              | Botões `sm`, abas e ações contextuais.        |
| Metadado                | 12 px, 400/500          | Datas, contagens, descrições e ajuda.         |
| Rótulo de grupo         | 11 px, 500, caixa alta  | Seções curtas de painel; usar com parcimônia. |
| Título de página        | 22 px, 500              | Um por tela comum.                            |
| Título do login         | 24 px, 400              | Convite de entrada no formulário.             |
| Chamada de apresentação | 30–36 px, 500           | Apenas no painel visual do login.             |
| Conteúdo impresso       | 12–16 px conforme papel | Priorizar legibilidade e proporção A4.        |

Usar peso 500 na maior parte da hierarquia. `font-semibold` e `font-bold` ficam para
número da questão, total, gabarito e contraste pontual. Evitar `tracking-tight`; reservar
espaçamento de letras para rótulos curtos em caixa alta.

## Espaçamento, borda e densidade

- A escala base é de 4 px; combinações recorrentes são 8, 12, 16, 20, 24 e 32 px.
- `gap-2` organiza controles próximos; `gap-3` separa itens; `gap-4/5` separa grupos.
- O raio base é `--radius: 0.625rem` (10 px). Usar os derivados dos primitivos.
- Painéis e cartões usam `rounded-xl`; controles compactos usam `rounded-md`; campos e
  botões padrão usam `rounded-lg`.
- A borda é neutra e fina. Estado de foco usa `ring`, nunca somente mudança de cor.
- Não ajustar altura, raio, peso ou padding de um primitivo em cada tela para “fazê-lo
  caber”. Uma exceção só é válida por função específica, como edição invisível no papel.

## Régua de controles

| Elemento               | Medida implementada                                       |
| ---------------------- | --------------------------------------------------------- |
| Button padrão          | 40 px de altura, 14 px, peso 500.                         |
| Button `sm`            | 32 px, 13 px; barras, filtros, listas e painéis.          |
| Button `xs`            | 28 px; ação contextual sobre outro elemento.              |
| Button `lg`            | 44 px, 15 px; ação principal do login.                    |
| Botão apenas com ícone | 40, 32 ou 28 px conforme contexto; sempre nome acessível. |
| Input e Select padrão  | 40 px, texto de 14 px.                                    |
| Select `sm`            | 32 px.                                                    |
| Textarea               | mínimo de 64 px; cresce com o conteúdo.                   |
| Badge                  | 24 px, texto de 12 px, formato de pílula.                 |

### Barras de rolagem

Áreas de trabalho com rolagem própria usam `scrollbar-sutil`: trilho transparente,
indicador fino e arredondado, cor derivada de `muted-foreground` e contraste um pouco
maior no hover. O trilho reserva apenas a largura necessária e não deve criar uma faixa
cinza competindo com a borda do painel.

- aplicar em canvas, estrutura e painéis contextuais do editor;
- manter a barra nativa do documento fora dessas regiões;
- abas horizontais continuam com scrollbar oculto, pois os próprios rótulos indicam o
  conteúdo rolável;
- nunca esconder scrollbar vertical de uma área longa nem reduzir sua área de clique a
  ponto de prejudicar a usabilidade.

### Hierarquia de ações

| Intenção                             | Variante                                                      |
| ------------------------------------ | ------------------------------------------------------------- |
| Próxima ação principal               | `Button` padrão.                                              |
| Fonte alternativa ou ação secundária | `outline`.                                                    |
| Ação de baixa ênfase                 | `ghost`.                                                      |
| Remoção                              | `destructive`, com rótulo ou nome acessível inequívoco.       |
| Ação indisponível                    | `disabled` e, quando necessário, Tooltip explicando o limite. |

Uma região deve ter uma ação primária evidente. No editor, “Nova questão” é primária e
“Banco de questões” é secundária. No login, “Entrar” ocupa toda a largura do formulário.

## Casca autenticada

A casca segue a composição “margem branca + workspace cinza”:

| Região        | Composição                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| Barra externa | 56 px, branca; marca à esquerda e Integrações, Ajuda e perfil à direita.                             |
| Moldura       | Margem de 12–16 px, `rounded-xl`, borda, `bg-field`, `overflow-hidden`.                              |
| Abas          | 48 px, dentro da moldura; ícone e rótulo sempre visíveis, ativa sobre branco com indicador inferior. |
| Página        | Painel da seção e conteúdo compartilham o mesmo campo cinza, separados por borda.                    |

Regras:

- Não usar sidebar global recolhível.
- Não esconder os nomes das seções atrás de ícones.
- A barra externa recebe apenas utilidades; navegação de domínio fica nas abas.
- Abas podem rolar horizontalmente sem exibir barra de rolagem.
- Seções comuns não usam breadcrumb: aba ativa e título já fornecem contexto.
- Login e editor usam `meta.telaCheia` e fornecem a própria composição.

## Layout de seção e listas

Em desktop, uma seção pode usar painel esquerdo de 256 px e conteúdo flexível. Em largura
estreita, o painel vira faixa acima do conteúdo; informação relevante não desaparece em
um menu lateral.

O painel reúne, nesta ordem: ação principal, busca, workspace/recortes e rodapé de apoio.
Contagens ficam dentro do recorte correspondente; não usar cartões de KPI para repetir
os mesmos números.

### Escolher lista ou tabela

- Se a linha **é o objeto que abre**, usar lista de cartões compactos. O cartão inteiro é
  um alvo e recebe chevron; ações destrutivas pertencem à tela do objeto.
- Se os registros precisam ser comparados por coluna, usar `Table` em `Card`, com
  cabeçalho, corpo e estado vazio no mesmo contêiner.
- Não criar um menu de linha apenas para preencher espaço.
- Conteúdo largo usa `min-w-0` e rolagem somente no trecho que excede a largura.

## Login

Em desktop, o login divide a janela igualmente:

- painel aubergine de apresentação à esquerda, com marca, chamada curta, ilustração e
  identificação do ambiente;
- formulário branco à direita, centralizado em coluna de no máximo 448 px;
- canto interno arredondado faz o formulário parecer pousado sobre o fundo escuro;
- ilustração tem movimento vertical lento e respeita `prefers-reduced-motion`;
- em telas menores, o painel visual é removido e a marca migra para o cabeçalho.

O login não deve carregar métricas, cartões de avaliação ou conteúdo operacional. A
imagem apoia a promessa do produto sem competir com o formulário.

## Editor de prova

O editor é um modo de trabalho em tela cheia, com barra própria e três zonas. Ele não usa
a casca autenticada.

| Zona      | Largura e função                                                                         |
| --------- | ---------------------------------------------------------------------------------------- |
| Estrutura | 240 px (`lg:w-60`); páginas calculadas, cabeçalho na Página 1 e ordem global dos blocos. |
| Folha     | Flexível; canvas rolável contendo a folha A4.                                            |
| Contexto  | 320 px (`lg:w-80`) em todos os estados: propriedades, autoria ou banco.                  |

Trocar o painel direito não pode mudar sua largura nem deslocar a folha. Em telas menores
as zonas empilham e permanecem utilizáveis.

Quando a prova não está em rascunho, um `Alert` de aviso aparece no topo da folha, dentro
do canvas rolável e fora da paginação, explicando a situação (aplicações já geradas ou
prova encerrada) sem bloquear a edição do conteúdo.

A estrutura espelha a paginação calculada: cada grupo começa com um marcador discreto
“Página N” e lista apenas os blocos daquela folha. O cabeçalho aparece como primeiro item
da Página 1. A hierarquia de página orienta sem virar um cartão pesado nem duplicar a
miniatura completa do papel.

### Folha e papel

- Largura física: 210 mm.
- Altura fixa por página: 297 mm.
- Margem interna: 16 mm em todas as larguras.
- O canvas central ajusta apenas a escala visual da folha para ela caber centralizada na
  largura disponível, sem rolagem horizontal. A geometria interna continua em 210 × 297 mm,
  portanto o ajuste não altera paginação, margens nem a saída futura para impressão.
- O editor mede cabeçalho e blocos na largura real do papel e cria novas folhas
  automaticamente quando o conteúdo excede a área útil.
- A quebra ocorre entre blocos para preservar a leitura de cada questão. Um bloco maior
  que toda a área útil permanece como caso limite a ser tratado na futura geração de PDF.
- Cabeçalho completo aparece na primeira folha; todas as folhas exibem número discreto na
  margem inferior.
- Editor e pré-visualização recebem os mesmos grupos de páginas; nunca manter dois
  algoritmos de quebra.
- “Nova questão” e “Banco de questões” ficam em uma barra flutuante compacta, centralizada
  na base do canvas e independente da rolagem das folhas. A barra usa superfície branca,
  borda, sombra discreta e mantém a ação primária evidente; ela nunca participa da
  paginação nem aparece na pré-visualização.

### Autoria de questões

“Nova questão” abre três tipos:

| Tipo             | Autoria                                                   | Saída no papel                                               |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| Múltipla escolha | Enunciado, 2 a 5 alternativas e seleção única da correta. | Alternativas com círculos vazios; o gabarito não é revelado. |
| Resposta curta   | Enunciado e pontuação.                                    | Quatro linhas em área mínima de 28 mm.                       |
| Resposta longa   | Enunciado e pontuação.                                    | Oito linhas em área mínima de 64 mm.                         |

O enunciado e as alternativas são editados diretamente na folha. Tipo de resposta,
pontuação, gabarito resumido, tags e ação “Salvar no banco” ficam no painel direito.
Radio é usado para o gabarito porque o domínio atual admite uma alternativa correta.

“Salvar no banco” cria ou atualiza uma questão reutilizável localmente. A autoria da
prova não exige salvar no banco, e uma questão trazida do banco entra como cópia editável
para não alterar o acervo silenciosamente.

### Conteúdo de apoio

Título de seção, texto/instrução e imagem podem ser inseridos como apoio e não recebem
número nem pontuação. Espaço de resposta não é uma opção isolada nova: ele pertence à
questão discursiva. Blocos antigos de espaço continuam renderizados por compatibilidade.

### Seleção e ações do bloco

- Seleção usa ring sobre a folha e sincroniza estrutura, canvas e painel direito.
- A barra contextual do bloco oferece mover, duplicar e excluir.
- A estrutura esquerda oferece setas como alternativa de teclado.
- Excluir oferece “Desfazer” por toast.
- Duplicar gera novos ids; uma questão duplicada não atualiza a mesma entrada do banco.

### Cabeçalho da prova

O cabeçalho é selecionável e configurado no painel direito:

- instituição, linha complementar, professor, descrição e instruções;
- campos opcionais de nome, matrícula, turma, data e nota;
- modelos salvos e aplicáveis a outras provas no mesmo navegador;
- marcador de QR fixo e sempre visível. Não existe opção para removê-lo; o QR válido só
  será gerado na aplicação da prova.

### Pré-visualização

A prévia segue o comportamento de apresentação do Figma:

- `Dialog` ocupa toda a janela para conter foco e permitir saída por `Escape`;
- canvas neutro pontilhado e folha A4 centralizada;
- controles flutuantes para fechar, zoom de 40% a 140% e ajuste à tela;
- mesmos renderizadores do editor em modo somente leitura;
- mesma distribuição automática de blocos entre as folhas;
- sem rings, ações de bloco, inputs ou indicação da resposta correta.

### Detalhe somente leitura

Entidades sem edição na N1 podem abrir um `Dialog` de detalhe a partir do cartão da
lista. O conteúdo deve expor os dados existentes em modo somente leitura, manter uma
ação futura desabilitada com Tooltip explicativo e fechar sem alterar o estado. O
detalhe de aplicação em `src/telas/Aplicacoes.vue` é a referência desse padrão.

### Gráfico

O formato padrão é **barra horizontal**, em `src/components/grafico/BarrasHorizontais.vue`.
Não há biblioteca de gráfico no projeto, e não deve haver enquanto uma barra for uma div
com largura proporcional; adicionar uma é decisão de issue própria.

| Elemento | Regra                                                                                    |
| -------- | ---------------------------------------------------------------------------------------- |
| Direção  | Horizontal. Os rótulos do domínio são texto ("8-10", título de prova) e giram mal.       |
| Trilho   | `bg-secondary`, 8 px, `rounded-full`.                                                    |
| Barra    | `bg-primary` sólido. **Nunca degradê**, nunca uma cor por item.                          |
| Valor    | Em texto, à direita, `tabular-nums` — a barra ordena, o número informa.                  |
| Escala   | `maximo` explícito quando o valor tem teto (nota); sem ele, a maior barra vira 100%.     |
| Decimais | `casasDecimais` acompanha a tabela vizinha, para o mesmo número não sair de duas formas. |

Uma série é uma única cor: a diferença entre as barras é o comprimento, não a tonalidade.
Cor por categoria só se justificaria se as categorias fossem comparadas entre gráficos, o
que não acontece nas telas atuais.

O gráfico nunca é a única forma de ler o dado: ao lado de cada barra fica o valor, e
abaixo dela, quando couber, a tabela com os mesmos números.

### Escolha com impedimento explicado

Quando um `Dialog` pede a escolha de um item de uma lista e alguns candidatos não podem
ser escolhidos por uma regra de domínio, o candidato impedido **permanece visível**,
desabilitado e com o motivo ao lado — não é removido da lista.

Esconder o impedido faz o usuário procurar o que não está lá e concluir que o sistema
perdeu o registro; mostrá-lo com o motivo responde a pergunta no lugar onde ela nasce.

- lista rolável com `scrollbar-sutil`, dentro de `fieldset` com `legend` acessível;
- cada linha é um `label` com `input` de seleção única, então o alvo de clique é a linha
  inteira e o teclado percorre a lista naturalmente;
- impedido usa opacidade reduzida, `disabled` e `Badge` `outline` com o motivo curto;
- a ação de confirmação fica desabilitada enquanto a escolha não for válida.

A fila de atribuição em `src/telas/Correcoes.vue` é a referência desse padrão.

## Estados, feedback e conteúdo

| Situação           | Padrão                                                        |
| ------------------ | ------------------------------------------------------------- |
| Carregamento       | Skeleton com geometria próxima do conteúdo final.             |
| Vazio              | Mensagem curta, motivo e uma ação recuperável quando existir. |
| Validação          | Mensagem junto do campo, `aria-invalid` e foco preservado.    |
| Sucesso            | Toast curto; não interrompe o fluxo.                          |
| Remoção reversível | Toast com ação “Desfazer”.                                    |
| Área futura        | Estado vazio honesto; não simular controles conectados.       |
| Erro destrutivo    | Token e variante `destructive`.                               |

## Acessibilidade e movimento

- Manter “Ir para o conteúdo” e região principal focável.
- Todo controle tem texto visível ou nome acessível.
- Ícones decorativos usam `aria-hidden="true"`.
- Aba ativa usa `aria-current`; filtro ativo usa `aria-pressed`.
- Reordenação nunca depende apenas de arrastar.
- Dialog, Select, DropdownMenu e Tooltip mantêm o comportamento de Reka UI.
- Foco visível nunca é removido sem substituição equivalente.
- Animações respeitam `prefers-reduced-motion`.

## Responsividade

| Faixa          | Comportamento                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Abaixo de `sm` | Marca textual e utilidades secundárias podem reduzir; formulário ocupa a largura; folha reduz sua escala visual para preservar a proporção A4 sem rolagem horizontal. |
| Abaixo de `lg` | Painéis de seção e zonas do editor empilham; metadados secundários de listas podem ser ocultados.                                                                     |
| `lg` ou maior  | Casca completa, painel de seção lateral e editor em três zonas.                                                                                                       |

Ocultar texto só é aceitável quando a função continua nomeada de forma acessível. Dados
essenciais não devem desaparecer; quando necessário, usar rolagem localizada.

## Mapa de implementação

| Padrão                                                        | Referência executável                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Tokens e fonte                                                | `src/styles/global.css`                                                                                 |
| Casca                                                         | `src/App.vue`, `src/components/casca/`                                                                  |
| Login                                                         | `src/telas/Login.vue`                                                                                   |
| Workspace/lista                                               | `src/telas/Provas.vue`, `src/telas/Turmas.vue`                                                          |
| Detalhe com tabela em Card, Dialog de formulário simples      | `src/telas/DetalheDaTurma.vue`                                                                          |
| Fila de trabalho em tabela, Dialog de escolha com impedimento | `src/telas/Correcoes.vue`                                                                               |
| Editor                                                        | `src/telas/EditorDeProva.vue`, `src/components/prova/`                                                  |
| Estado local do protótipo                                     | `src/lib/estado-de-provas.ts`, `estado-de-questoes.ts`, `cabecalhos-da-prova.ts`, `estado-de-turmas.ts` |
| Primitivos                                                    | `src/components/ui/`                                                                                    |

## Checklist de entrega

1. Confirmar requisito, rota, dados e limites da fase.
2. Reutilizar tokens e primitivos existentes.
3. Conferir hierarquia de superfícies, densidade e ação primária.
4. Implementar carregamento, vazio, erro e largura estreita quando aplicável.
5. Verificar teclado, foco, nomes acessíveis e movimento reduzido.
6. Atualizar este documento quando houver um padrão novo.
7. Atualizar `experiencia-web-atual.md` quando o comportamento executável mudar.
8. Rodar `npm run typecheck --workspace @sgp/web`,
   `npm run build --workspace @sgp/web` e `git diff --check`.
