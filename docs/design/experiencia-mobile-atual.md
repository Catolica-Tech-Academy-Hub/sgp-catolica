# Experiência mobile atual

## Escopo e situação

Este documento descreve o aplicativo do professor executável na N1 (`apps/mobile`,
React Native/Expo). Regras visuais ficam no
[design system mobile](design-system-mobile.md).

Classificação usada, a mesma da web:

- **Implementado na N1:** tela navegável com estado local suficiente para demonstração.
- **Marcador:** tela ou controle visível sem funcionalidade de produto.

## Mapa de navegação

Stack simples; o fluxo do professor é linear. Nomes das rotas conforme
`src/navegacao/index.tsx`.

| Rota                     | Situação                    | Experiência atual                                                                                       |
| ------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `AplicacoesParaCorrigir` | Implementado na N1 (mínimo) | Rota inicial. Aplicações com prova gerada e pendências; aviso de correção salva na fila. Completa: #24. |
| `SelecionarProva`        | Implementado na N1 (mínimo) | Leitura do QR Code ou escolha na lista como alternativa. Completa: #25.                                 |
| `LeituraQrCode`          | Parcial (#97)               | Câmera e validação local do QR. Sem teste em aparelho físico; formato final depende da #91.             |
| `ConferenciaObjetiva`    | Implementado na N1 (mínimo) | Toque na letra marcada; certo/errado contra o gabarito e nota objetiva. Completa: #26.                  |
| `LeituraCartao`          | Parcial (#98)               | Leitura local com revisão manual. Sem captura de foto, hoje termina em "Leitura bloqueada".             |
| `NotasDiscursivas`       | Implementado na N1          | Notas discursivas, nota total, identificação auxiliar e "Confirmar correção" (#27).                     |
| `Ambiente`               | Implementado na N1          | Valida a arquitetura. Continua registrada, mas deixou de ser a rota inicial.                            |

As três primeiras telas foram feitas no mínimo necessário para o fluxo chegar à correção
discursiva com dados reais; as issues #24, #25 e #26 seguem abertas para completá-las.

### Fluxo de correção (RF08)

1. **Aplicações para corrigir.** Lista de `listarAplicacoesGeradas()`. Prova sem
   identificação não tem total impresso conhecido, então mostra "Sem contagem de provas"
   em vez de um número inventado.
2. **Selecionar prova.** O botão "Ler QR Code" abre a leitura pela câmera, que pode levar
   direto à conferência. A lista de `listarAtribuicoesDaAplicacao()` continua como
   alternativa para QR danificado ou câmera sem permissão. Prova já corrigida aparece, mas
   não reabre por nenhum dos dois caminhos: RF08 nunca sobrescreve uma correção em
   silêncio.
3. **Conferência objetiva.** Para cada questão objetiva, as letras na ordem impressa
   daquela versão (`printedOrder`). O professor toca na letra marcada a caneta; a tela
   mostra se acertou e a nota objetiva no rodapé. Só avança quando cada questão tem uma
   alternativa ou foi decidida como em branco, porque a alternativa escolhida
   (`selectedAlternativeId`) é o que vai para a fila. Questão com alternativa marcada ou
   com leitura divergente mostra o botão "Em branco". O botão "Ler cartão" abre a leitura
   descrita abaixo; o toque continua funcionando sem ela.
4. **Notas discursivas.** Para cada questão discursiva: número impresso, enunciado (do
   banco de questões, pelo `questionId`), máximo e campo de nota. A nota aceita vírgula
   ou ponto e até duas casas decimais, não pode ser negativa nem passar do `maxScore` do
   gabarito local. A nota total — **objetiva + soma das discursivas** — é recalculada a
   cada digitação e marcada como parcial enquanto houver nota inválida.
5. **Confirmar correção.** Valida as notas e chama `enfileirarCorrecao`, que grava o item
   no aparelho. Só depois da gravação a correção conta como confirmada: o item nasce
   `pending`, e o professor volta à lista com o aviso de que ela está salva no aparelho,
   sem ter sido enviada. A tela da fila é a issue #28.

Sem cópia local do gabarito, salva no aparelho ou nos mocks (hoje, versões 0 e 4), a
conferência e a confirmação ficam desabilitadas e explicadas.

### Leitura do QR Code (issue #97, em andamento)

Fluxo: `SelecionarProva` → **Ler QR Code** → `LeituraQrCode` → validação local →
`ConferenciaObjetiva`, com a mesma versão e o mesmo aluno da escolha na lista.

- **A leitura identifica a prova e não confirma a correção.** A confirmação continua sendo
  a da tela de notas.
- **O conteúdo do QR é um valor opaco.** Ele é comparado por igualdade exata com os dados
  locais, em `src/lib/leitura-do-qr.ts`, sem depender de um formato. Com identificação, vale
  o QR da atribuição do aluno; sem identificação, o QR da versão.
- **QR recusado não altera nenhuma correção.** Ilegível, desconhecido, de outra aplicação,
  sem gabarito local ou de prova já corrigida mostra uma mensagem clara, com as opções de
  ler novamente ou escolher na lista.
- **Permissão.** A câmera pede permissão ao professor e, se negada, a tela explica e mantém
  a escolha na lista. O aplicativo não solicita microfone.

#### O que foi verificado

- Regras de validação cobertas por testes automatizados, no total de testes do mobile.
- Configuração nativa gerada pelo Expo, com câmera e sem microfone, e bundle iOS de
  produção gerado sem erro.

#### O que ainda não foi verificado ou definido

- **A leitura pela câmera ainda não foi testada em aparelho físico.** Abertura da câmera,
  resposta à permissão, foco, distância, iluminação e QR impresso continuam sem validação,
  e nenhuma taxa de acerto da leitura foi medida.
- **O formato final do QR depende da issue #91**, e a impressão no PDF depende da #92. Até
  lá, os valores vêm de `packages/mocks`, e um QR de geração substituída aparece como não
  reconhecido.
- **Nos dados de demonstração, só `mock-qr-versao-3` abre a conferência.** As demais provas
  identificadas já constam como corrigidas e são recusadas.

### Leitura do cartão-resposta (issue #98, em andamento)

Fluxo: `ConferenciaObjetiva` → **Ler cartão** → `LeituraCartao` → revisão questão a
questão → **Aplicar e voltar à correção** → `ConferenciaObjetiva` → `NotasDiscursivas` →
confirmação normal. Sair sem aplicar não confirma a nova leitura e preserva as decisões
do professor, mas uma divergência com a leitura anterior continua pendente.

A leitura usa o núcleo local e provisório de `src/viabilidade/` (marcadores, perspectiva
e bolhas), sem rede. As regras ficam em `src/lib/leitura-do-cartao.ts`:

- **A leitura nunca confirma a correção.** Ela só produz sugestões. O aceite do professor
  preenche a conferência, e a confirmação continua sendo a da tela de notas.
- **A decisão manual do professor tem prioridade.** O toque em uma alternativa, a escolha
  de "Em branco" na conferência e a escolha feita na revisão não são sobrescritos por
  nenhuma leitura.
- **Sugestão anterior da leitura não é decisão manual.** A conferência guarda quais
  valores vieram de uma leitura aceita. Uma nova leitura segura com o mesmo valor mantém a
  sugestão, inclusive quando as duas veem a questão em branco.
- **Nova leitura divergente exige nova revisão.** Dupla marcação, leitura ambígua, bolha
  não localizada ou outro valor seguro tiram a sugestão anterior da conferência. A
  questão fica pendente mesmo que o professor saia sem aplicar, e "Continuar" só libera
  depois que ele escolher uma letra ou deixar em branco. Outra leitura não resolve essa
  pendência.
- **Dupla marcação, leitura ambígua e bolha não localizada exigem decisão manual.** A
  questão vai para revisão, nenhuma alternativa é escolhida automaticamente e "Aplicar"
  fica desabilitado até o professor escolher uma letra ou deixar em branco.
- **Questão em branco não entra nas respostas e vale zero.** Ela fica fora de
  `objectiveAnswers`, sem alterar o contrato da fila nem o cálculo da nota.
- **Falha de leitura bloqueia.** Sem imagem, sem marcadores, com perspectiva inválida ou
  com prova incompatível com o cartão provisório, a tela explica o motivo e não altera as
  marcações.

A entrada de imagem é um ponto de integração (`definirFonteDeImagem`). Nenhuma fonte está
registrada no aplicativo, por isso **"Ler cartão" hoje sempre termina em "Leitura
bloqueada"**, em vez de simular um resultado.

#### O que foi verificado

- Testes automatizados do mobile (`npm run test --workspace @sgp/mobile`) no Node 20: 184
  de 184 testes passaram, incluindo os gabaritos locais, a fila persistente, a validação do
  QR Code, a segunda leitura, a saída com divergência, a decisão manual em branco e a
  leitura com o núcleo real sobre uma imagem sintética.

#### O que ainda não foi verificado ou integrado

- **Cartão impresso e fotos reais: teste não executado**, por falta de acesso a uma
  impressora. Os resultados acima vêm apenas de imagens sintéticas.
- **A taxa de erro inferior a 1% exigida pelo RF08 ainda não pode ser afirmada.**
- **A captura do cartão pela câmera não está integrada.** A câmera hoje só lê QR Code, e a
  leitura do cartão não foi executada em aparelho físico.
- **O layout definitivo do cartão depende da issue #92.** O layout atual é provisório e
  comporta até 20 questões de até 5 alternativas.
- **A leitura do cartão não confere o QR Code da folha.** O QR identifica a prova antes da
  conferência, mas o professor ainda precisa conferir se o cartão lido é o dessa prova.
- **Sombra dura sobre a folha pode aumentar a revisão manual.** Esse limite foi aceito na
  viabilidade: nos testes sintéticos, a regra prefere mandar a questão para revisão a
  arriscar uma resposta automática.

### Fila local persistente (issue #99, em andamento)

As correções confirmadas ficam salvas no aparelho com AsyncStorage, pela camada
`src/lib/fila-persistente.ts`, e sobrevivem ao fechamento e à reabertura do aplicativo.

- **Cada item é gravado completo**, em uma chave própria, com o `answerKeySnapshot` e o
  status (`pending`, `synced` ou `error`).
- **A confirmação só acontece depois da gravação local.** Se ela falhar, a tela avisa, a
  correção não entra na fila e uma nova tentativa reutiliza o mesmo `clientCorrectionId`.
- **A fila é carregada antes da navegação**, em `CargaDaFila`. Se a leitura falhar, o
  aplicativo oferece nova tentativa e não abre, para uma prova corrigida não parecer
  pendente.
- **Item salvo ilegível não é apagado.** Ele não impede a leitura dos demais, e a lista de
  aplicações avisa o professor.
- **Os mocks não são gravados.** Ao carregar, mocks e itens salvos são unidos por
  `clientCorrectionId`, sem duplicar; com o mesmo identificador, vale o item salvo.

#### O que foi verificado

- Testes automatizados cobrem gravação, reabertura, falhas e não duplicação, usando um
  armazenamento em memória no lugar do AsyncStorage.

#### O que ainda não foi verificado ou implementado

- **O teste em aparelho físico com o AsyncStorage real ainda não foi executado.**
- **A sincronização com o servidor ainda não existe** e depende das issues #94 e #95.
- **O envio para `POST /correcoes/lote` ainda não está implementado.** Nenhum item é enviado,
  e novas correções continuam como `pending`.

### Gabaritos locais (issue #96, em andamento)

A camada `src/lib/gabaritos-locais.ts` guarda no AsyncStorage uma cópia do gabarito de cada
versão, para a correção funcionar sem sinal. **Hoje nada grava nesse cache no aplicativo**,
porque o download depende da API. Na prática, o fluxo continua usando os gabaritos dos
mocks até essa etapa existir.

- **Cada versão tem uma chave própria**, separada das chaves da fila, com um
  `GabaritoVersaoSnapshot` e a data da última atualização em `capturedAt`.
- **Só uma cópia mais recente substitui a atual.** Cópia igual ou mais antiga é ignorada.
- **Dado inválido não é aceito.** Um item corrompido é mantido no aparelho, sem impedir a
  leitura das outras versões.
- **A ordem de consulta é cache e depois mocks.** `obterGabaritoDaVersao()` usa primeiro a
  cópia salva. Os mocks são a reserva e nunca são gravados no cache.
- **O gabarito salvo precisa bater com a folha impressa.** Se as questões ou a ordem das
  alternativas diferirem do layout da versão, a cópia é ignorada e não é apagada.
- **O cache é carregado antes da navegação**, junto da fila, em `CargaDaFila`. Uma falha de
  leitura impede a abertura e oferece nova tentativa.
- **O cache é diferente do `answerKeySnapshot` da fila.** O cache guarda a cópia mais recente
  da versão; o snapshot registra o gabarito usado em uma correção e não muda depois.

#### O que foi verificado

- Testes automatizados cobrem gravação, substituição, dados inválidos, prioridade sobre os
  mocks, fallback e compatibilidade com o layout, usando um armazenamento em memória no
  lugar do AsyncStorage.

#### O que ainda não foi verificado ou implementado

- **O teste em aparelho físico com o AsyncStorage real ainda não foi executado.**
- **A lista de aplicações e o download dos gabaritos pela API dependem das issues #94 e
  #95.** O aplicativo não faz chamadas de rede.
- **Ainda não existem** os estados de carregando, sem conexão e sem gabarito local na lista
  de aplicações, nem a exibição da data da última atualização.
- **Um gabarito salvo durante a sessão só passa a valer na próxima abertura.** Antes de
  atualizar a memória, a correção em andamento precisa fixar o gabarito que está usando.
- **Isolamento e limpeza do cache por professor dependem do login (#95).** O gabarito fica
  sem criptografia no AsyncStorage.

### Prova sem identificação e o limite do RF09

Quando `withStudentIdentification` é `false`, a tela de notas mostra campos de nome e
matrícula, opcionais, com o aviso de que são **apenas auxiliares**. Eles vão para a fila
como `reportedStudentName` e `reportedStudentRegistration`, mas a correção segue **sem
`studentId`**: a nota é calculada e exibida, sem dono. Atribuí-la a um aluno é o RF09,
feito pela web (issue #18); o aplicativo não cria esse vínculo.

## Arquitetura

| Camada     | Onde vive                        | Papel                                               |
| ---------- | -------------------------------- | --------------------------------------------------- |
| Raiz       | `App.tsx`                        | Só a casca: área segura, barra de status e o stack. |
| Navegação  | `src/navegacao/index.tsx`        | Stack e tipos das rotas.                            |
| Telas      | `src/telas/`                     | Uma tela por arquivo; a composição fica nela.       |
| Primitivos | `src/components/ui/`             | Botão, Cartão, Campo, Rótulo, Badge e Tela.         |
| Estado     | `src/lib/estado-de-correcoes.ts` | Ponto único de integração quando a API existir.     |
| Leitura    | `src/lib/leitura-do-cartao.ts`   | Sugestões, prioridade do professor e aceite.        |
| QR Code    | `src/lib/leitura-do-qr.ts`       | Validação do QR como valor opaco.                   |
| Fila local | `src/lib/fila-persistente.ts`    | Gravação e leitura da fila no aparelho.             |
| Gabaritos  | `src/lib/gabaritos-locais.ts`    | Cópia local dos gabaritos por versão.               |

### Estado local

Mesmo papel dos `estado-de-*.ts` da web, com uma diferença de mecânica: o React não tem
reatividade automática como o `reactive` do Vue, então o módulo mantém um conjunto de
assinantes e cada tela se liga a ele por `useEstadoDeCorrecoes()`. É deliberadamente
simples — trazer um gerenciador de estado para a fase que menos precisa dele seria peso
sem retorno.

O módulo já expõe o que o fluxo de correção vai consumir: aplicações com prova gerada e a
contagem de pendências, as atribuições de uma aplicação, as provas que um QR Code pode
identificar, a cópia local do gabarito e a fila local.

### Regras do RF08 respeitadas desde a arquitetura

- **Sem cópia local do gabarito, não se confirma correção.** `enfileirarCorrecao` recusa
  a confirmação quando não há gabarito para aquela versão, em vez de gravar uma correção
  sem referência.
- **Identificador gerado no dispositivo.** Cada item da fila nasce com um
  `clientCorrectionId` local, que é o que permite a deduplicação idempotente. Não usa
  `crypto.randomUUID`, que não existe no runtime do React Native sem polyfill.
- **Item novo nasce `pending`.** Nada foi enviado; chamar de sincronizado seria mentira.

## Limites conhecidos

- **A fila persiste no aparelho, mas não sincroniza.** O envio para `POST /correcoes/lote`
  depende das issues #94 e #95, e a persistência ainda não foi testada em aparelho físico.
- **O cache de gabaritos existe, mas ainda não recebe dados.** O download depende das
  issues #94 e #95, e o fluxo continua usando os gabaritos dos mocks.
- **Leitura de QR Code sem validação em aparelho físico.** A câmera lê o QR (#97), mas esse
  fluxo ainda não foi testado em um aparelho, e o formato final do QR depende da #91. A
  escolha na lista continua como alternativa e produz o mesmo efeito: chegar a uma versão
  e, quando há identificação, a um aluno.
- **O cartão-resposta ainda não recebe fotos.** O núcleo de leitura de imagem existe (#98),
  mas a captura pela câmera não está ligada a ele.
- **Sem autenticação real.** Como na web, a entrada valida formato e abre o protótipo.
- **A fonte Instrument Sans não é carregada.** O pacote da web distribui só `.woff2`, que
  o React Native não aceita; o aplicativo usa a fonte do sistema. Ver a limitação
  registrada no design system mobile.
- **O CI não roda o typecheck do mobile.** Ele só roda commitlint, format e lint. O
  comando `npm run typecheck --workspace @sgp/mobile` precisa ser executado localmente.

## Como rodar

```bash
npm run mobile            # expo start
npm run test --workspace @sgp/mobile
npm run typecheck --workspace @sgp/mobile
npm run lint --workspace @sgp/mobile
```

O aplicativo também sobe no navegador (`expo start --web`), com `react-dom` e
`react-native-web` instalados. Isso não substitui o teste em dispositivo, mas permite ver
as telas sem emulador. A leitura de QR Code pela câmera ainda precisa ser validada em
aparelho físico.
