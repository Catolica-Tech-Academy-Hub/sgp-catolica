# Design system mobile — SGP Católica

## Papel deste documento

Fonte normativa de UI do aplicativo do professor (`apps/mobile`, React Native/Expo). O
aplicativo é a **única superfície do sistema com leitura de QR Code e de cartão-resposta**
(RF08); tudo aqui existe a serviço desse fluxo.

Este documento não cria uma linguagem visual nova. Ele mapeia a linguagem já decidida no
[design system web](design-system-web.md) para as restrições do celular, e registra
onde os dois se afastam **de propósito**.

## O que é compartilhado e o que é próprio

| Camada              | Onde vive                                                      |
| ------------------- | -------------------------------------------------------------- |
| Tokens visuais      | `packages/design-tokens` — cor, espaçamento, raio, tipografia. |
| Tipos do domínio    | `packages/shared-types`.                                       |
| Dados da fase N1    | `packages/mocks`.                                              |
| Primitivos de UI    | `apps/mobile/src/components/ui` (próprios do mobile).          |
| Estado do protótipo | `apps/mobile/src/lib/estado-de-*.ts`.                          |

Não há shadcn para React Native, então os primitivos são escritos à mão em `StyleSheet`
sobre os tokens. A decisão de adotar NativeWind/Tailwind no mobile **não foi tomada**;
propor isso é issue própria, não carona numa tela.

## Cor

As cores vêm de `@sgp/design-tokens`, que é a conversão para hex do tema claro da web.
Os papéis têm os mesmos nomes dos da web (`background`, `field`, `card`, `primary`,
`secondary`, `accent`, `muted`, `destructive`, `border`, `ring`, `sheet`) justamente para
a correspondência ser conferível linha a linha.

- `field` é o fundo de toda tela: o campo de trabalho cinza da web.
- `card` é o objeto elevado — item de lista, painel, estado vazio.
- `primary` é ação principal, seleção e foco. Aubergine, igual à web.
- `destructive` é remoção e erro, nunca ação comum.
- **Nunca degradê**, nunca cor literal numa tela. Se falta um papel, ele entra nos tokens.

`StyleSheet` não aceita `oklch()`, então os valores são hex. Enquanto o tema da web
estiver em OKLCH e estes em hex, mudar um exige mudar o outro — está registrado em
`.claude/rules/10-pacotes-compartilhados.md`.

## Tipografia

Escala em `tipografia.tamanho`: 12 (metadado), 13 (controle compacto), 14 (texto
operacional), 18 (título de cartão), 22 (título de tela), 28 (número grande). Peso 500
domina a hierarquia; 600 fica para número de questão, total e gabarito.

**Limitação conhecida e não resolvida**: a web usa Instrument Sans Variable pelo pacote
`@fontsource-variable/instrument-sans`, que distribui **somente `.woff2`** — formato que
o React Native não carrega (precisa de `.ttf` ou `.otf`). Enquanto ninguém versionar o
`.ttf` e registrá-lo com `expo-font`, o aplicativo cai no `system-ui` de cada plataforma.
É uma divergência visual real entre web e mobile, não um detalhe de implementação.

## Densidade e medidas

| Elemento            | Medida                                                                   |
| ------------------- | ------------------------------------------------------------------------ |
| Botão padrão        | 44 px de altura — o alvo de toque confortável, maior que os 40 do mouse. |
| Botão `sm`          | 36 px.                                                                   |
| Campo de texto      | 44 px; multilinha começa em 96 px.                                       |
| Badge               | 24 px, texto de 12 px, pílula.                                           |
| Raio de cartão      | `raio.lg` (12 px); campo e botão usam `raio.md` (10 px).                 |
| Espaçamento de tela | `espacamento.lg` (16 px) nas bordas; `md` (12 px) entre blocos.          |

Os alvos de toque nunca ficam abaixo de 44 px. Onde a web pode usar um botão de 28 px
sobre outro elemento, o mobile não pode.

## Composição de tela

Toda tela usa o primitivo `Tela`, que é o equivalente da casca da web:

- fundo `field`, título e descrição no topo, conteúdo rolável;
- **ação principal em barra fixa na base**, não no fim da rolagem.

Essa barra é o afastamento deliberado da web: no celular a próxima ação precisa estar sob
o polegar, não a uma rolagem de distância. Na web, a ação principal vive no painel ou no
cabeçalho da seção.

## Navegação

Stack simples (`@react-navigation/native-stack`), não abas. O fluxo do professor é
linear — lista da aplicação, prova a corrigir, conferência, confirmação — e cada passo
depende do anterior. Abas servem a seções paralelas, que é o caso da web, não daqui.

O cabeçalho da navegação usa os tokens compartilhados, para a barra não introduzir uma
terceira linguagem visual entre a web e o conteúdo das telas.

## Estados e honestidade

Valem as mesmas regras da web, com a mesma severidade:

- carregamento, vazio com motivo, e erro que diz o que fazer;
- ação sem backend fica **desabilitada e explicada**, nunca simulada;
- persistência local nunca é apresentada como sincronização real.

No mobile isso tem um caso próprio e importante: a fila local de correções vive na
memória da sessão. RF08 exige que a fila sobreviva ao fechamento do aplicativo, o que
depende de armazenamento do dispositivo e pertence a uma fase com backend. A tela de fila
diz isso em vez de fingir.

## Acessibilidade

React Native não tem ARIA; os equivalentes são obrigatórios:

- `accessibilityRole` em todo controle (`button`, `header`, `alert`);
- `accessibilityLabel` em todo alvo sem texto visível;
- `accessibilityState` para `disabled`, `busy`, `selected`, `checked`;
- a mensagem de erro de um campo entra no `accessibilityLabel` dele — não existe
  `aria-describedby`, então sem isso o leitor de tela anuncia "inválido" sem o motivo;
- foco e seleção nunca comunicados só por cor: borda, anel ou marca junto.

## Checklist de entrega

1. Confirmar requisito, dados e limites da fase.
2. Reutilizar os tokens e os primitivos de `src/components/ui`; não montar controle à mão.
3. Conferir alvo de toque de 44 px, estados e nomes acessíveis.
4. Atualizar [experiência mobile atual](experiencia-mobile-atual.md) quando o
   comportamento executável mudar, e este documento quando nascer um padrão novo.
5. Rodar `npm run lint --workspace @sgp/mobile` e `git diff --check`.
