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
| `SelecionarProva`        | Implementado na N1 (mínimo) | Escolha da prova na lista, no lugar da leitura do QR Code. Completa: #25.                               |
| `ConferenciaObjetiva`    | Implementado na N1 (mínimo) | Toque na letra marcada; certo/errado contra o gabarito e nota objetiva. Completa: #26.                  |
| `LeituraCartao`          | Parcial (#98)               | Leitura local com revisão manual. Sem câmera integrada, hoje termina em "Leitura bloqueada".            |
| `NotasDiscursivas`       | Implementado na N1          | Notas discursivas, nota total, identificação auxiliar e "Confirmar correção" (#27).                     |
| `Ambiente`               | Implementado na N1          | Valida a arquitetura. Continua registrada, mas deixou de ser a rota inicial.                            |

As três primeiras telas foram feitas no mínimo necessário para o fluxo chegar à correção
discursiva com dados reais; as issues #24, #25 e #26 seguem abertas para completá-las.

### Fluxo de correção (RF08)

1. **Aplicações para corrigir.** Lista de `listarAplicacoesGeradas()`. Prova sem
   identificação não tem total impresso conhecido, então mostra "Sem contagem de provas"
   em vez de um número inventado.
2. **Selecionar prova.** Lista de `listarAtribuicoesDaAplicacao()`. Prova já corrigida
   aparece, mas não reabre: RF08 nunca sobrescreve uma correção em silêncio.
3. **Conferência objetiva.** Para cada questão objetiva, as letras na ordem impressa
   daquela versão (`printedOrder`). O professor toca na letra marcada a caneta; a tela
   mostra se acertou e a nota objetiva no rodapé. Só avança quando cada questão tem uma
   alternativa ou foi aceita como em branco na leitura do cartão, porque a alternativa
   escolhida (`selectedAlternativeId`) é o que vai para a fila. O botão "Ler cartão" abre
   a leitura descrita abaixo; o toque continua funcionando sem ela.
4. **Notas discursivas.** Para cada questão discursiva: número impresso, enunciado (do
   banco de questões, pelo `questionId`), máximo e campo de nota. A nota aceita vírgula
   ou ponto e até duas casas decimais, não pode ser negativa nem passar do `maxScore` do
   gabarito local. A nota total — **objetiva + soma das discursivas** — é recalculada a
   cada digitação e marcada como parcial enquanto houver nota inválida.
5. **Confirmar correção.** Valida as notas e chama `enfileirarCorrecao`. O item nasce
   `pending`, e o professor volta à lista com o aviso de que a correção está na fila
   local, sem ter sido enviada. A tela da fila é a issue #28.

Sem cópia local do gabarito (hoje, versões 0 e 4 dos mocks), a conferência e a
confirmação ficam desabilitadas e explicadas.

### Leitura do cartão-resposta (issue #98, em andamento)

Fluxo: `ConferenciaObjetiva` → **Ler cartão** → `LeituraCartao` → revisão questão a
questão → **Aplicar e voltar à correção** → `ConferenciaObjetiva` → `NotasDiscursivas` →
confirmação normal. **Voltar sem aplicar** não altera nenhuma marcação.

A leitura usa o núcleo local e provisório de `src/viabilidade/` (marcadores, perspectiva
e bolhas), sem rede. As regras ficam em `src/lib/leitura-do-cartao.ts`:

- **A leitura nunca confirma a correção.** Ela só produz sugestões. O aceite do professor
  preenche a conferência, e a confirmação continua sendo a da tela de notas.
- **A decisão do professor tem prioridade.** O toque na revisão vence a marcação atual, e
  a marcação atual vence a sugestão da leitura.
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

- Testes automatizados do mobile (`npm run test --workspace @sgp/mobile`): 20 de 20
  passando, incluindo a leitura com o núcleo real sobre uma imagem sintética.
- Typecheck, lint, Prettier e `git diff --check` passando nesta etapa.
- Fluxo percorrido no navegador com `react-native-web` e um cartão sintético injetado só
  no ambiente de teste: marcação manual mantida, dupla marcação em revisão, questão em
  branco, voltar sem aplicar, aplicar e leitura bloqueada.

#### O que ainda não foi verificado ou integrado

- **Cartão impresso e fotos reais: teste não executado**, por falta de acesso a uma
  impressora. Os resultados acima vêm apenas de imagens sintéticas.
- **A taxa de erro inferior a 1% exigida pelo RF08 ainda não pode ser afirmada.**
- **A câmera real não está integrada**, e a leitura não foi executada em aparelho físico.
- **O layout definitivo do cartão depende da issue #92.** O layout atual é provisório e
  comporta até 20 questões de até 5 alternativas.
- **A identificação da folha por QR Code depende da issue #97.** Até lá, o aplicativo não
  sabe se o cartão pertence àquela prova, e o professor precisa conferir.
- **Sombra dura sobre a folha pode aumentar a revisão manual.** Esse limite foi aceito na
  viabilidade: nos testes sintéticos, a regra prefere mandar a questão para revisão a
  arriscar uma resposta automática.

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

### Estado local

Mesmo papel dos `estado-de-*.ts` da web, com uma diferença de mecânica: o React não tem
reatividade automática como o `reactive` do Vue, então o módulo mantém um conjunto de
assinantes e cada tela se liga a ele por `useEstadoDeCorrecoes()`. É deliberadamente
simples — trazer um gerenciador de estado para a fase que menos precisa dele seria peso
sem retorno.

O módulo já expõe o que o fluxo de correção vai consumir: aplicações com prova gerada e a
contagem de pendências, as atribuições de uma aplicação (o que o QR Code identificaria), a
cópia local do gabarito e a fila local.

### Regras do RF08 respeitadas desde a arquitetura

- **Sem cópia local do gabarito, não se confirma correção.** `enfileirarCorrecao` devolve
  vazio quando não há gabarito para aquela versão, em vez de gravar uma correção sem
  referência.
- **Identificador gerado no dispositivo.** Cada item da fila nasce com um
  `clientCorrectionId` local, que é o que permite a deduplicação idempotente. Não usa
  `crypto.randomUUID`, que não existe no runtime do React Native sem polyfill.
- **Item novo nasce `pending`.** Nada foi enviado; chamar de sincronizado seria mentira.

## Limites conhecidos

- **A fila não sobrevive ao fechamento do aplicativo.** RF08 exige isso, e depende de
  armazenamento do dispositivo — fase com backend. Hoje a fila vive na memória da sessão.
- **Sem câmera integrada e sem QR Code.** O núcleo de leitura de imagem existe (#98), mas
  o fluxo ainda não recebe fotos. A seleção da prova a corrigir é feita por escolha na
  lista, que produz o mesmo efeito de uma leitura de QR Code: chegar a uma versão e,
  quando há identificação, a um aluno.
- **Sem autenticação real.** Como na web, a entrada valida formato e abre o protótipo.
- **A fonte Instrument Sans não é carregada.** O pacote da web distribui só `.woff2`, que
  o React Native não aceita; o aplicativo usa a fonte do sistema. Ver a limitação
  registrada no design system mobile.
- **O CI não roda o typecheck do mobile.** Ele só roda commitlint, format e lint. O
  comando `npm run typecheck --workspace @sgp/mobile` passou na etapa atual da #98, mas
  precisa ser executado localmente.

## Como rodar

```bash
npm run mobile            # expo start
npm run test --workspace @sgp/mobile
npm run typecheck --workspace @sgp/mobile
npm run lint --workspace @sgp/mobile
```

O aplicativo também sobe no navegador (`expo start --web`), com `react-dom` e
`react-native-web` instalados. Isso não substitui o teste em dispositivo, mas permite ver
as telas sem emulador. O fluxo normal não abre a câmera.
