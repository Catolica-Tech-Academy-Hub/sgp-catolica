---
name: sgp-catolica-mobile
description: Padroes obrigatorios para criar ou revisar telas do aplicativo do professor do SGP Catolica (apps/mobile, React Native + Expo). Use ao implementar tela, ajustar UI, revisar layout, tokens, navegacao, acessibilidade ou o fluxo de correcao (RF08) no mobile.
---

# UI do aplicativo do professor

Aplicativo do professor em React Native/Expo. É a **única superfície do sistema com
leitura de QR Code e de cartão-resposta** (RF08); tudo aqui existe a serviço desse fluxo.

Aqui não se cria identidade visual nova: os tokens são os mesmos da web, convertidos.

## Fonte de verdade

Leia antes de escrever código de tela:

| Documento                                                                                   | Quando                                                                     |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [docs/design/design-system-mobile.md](../../../docs/design/design-system-mobile.md)         | Cor, tipografia, densidade, composição de tela, navegação, acessibilidade. |
| [docs/design/experiencia-mobile-atual.md](../../../docs/design/experiencia-mobile-atual.md) | Rotas existentes, arquitetura, regras do RF08 já respeitadas e limites.    |
| [docs/design/design-system-web.md](../../../docs/design/design-system-web.md)               | A linguagem de origem: o mobile mapeia, não reinventa.                     |
| [docs/produto/requisitos-funcionais.md](../../../docs/produto/requisitos-funcionais.md)     | RF08 (correção), RF09 (lançamento manual) e os critérios de aceite.        |

`apps/mobile/src/telas/Ambiente.tsx` é a referência executável de composição de tela.

## Limites que não se negociam

- **Tokens**: cor, espaçamento, raio e tipografia vêm de `@sgp/design-tokens`. Nenhum hex
  literal numa tela; sem degradê. Faltando um papel, ele entra nos tokens — que precisam
  continuar batendo com o tema da web (`apps/web/src/styles/global.css`), e o
  `tokens.css` do pacote é atualizado junto.
- **Primitivos**: use `apps/mobile/src/components/ui` (`Botao`, `Cartao`, `Campo`,
  `Rotulo`, `Badge`, `Tela`). Não monte botão, cartão ou campo à mão. Não há shadcn para
  React Native, e adotar NativeWind/Tailwind é decisão de issue própria.
- **Composição**: toda tela usa `Tela` — fundo `field`, título no topo, conteúdo rolável e
  ação principal em **barra fixa na base**. Essa barra é o afastamento deliberado da web:
  no celular a próxima ação precisa estar sob o polegar.
- **Navegação**: stack simples, nunca abas. O fluxo é linear e cada passo depende do
  anterior. Rotas e tipos em `src/navegacao/index.tsx`.
- **Estado**: dados vêm de `src/lib/estado-de-*.ts`, nunca de `@sgp/mocks` direto para
  alterar algo. Cada tela se liga por `useEstadoDeCorrecoes()`.
- **Alvo de toque**: nunca abaixo de 44 px. O botão de 28 px que a web permite sobre outro
  elemento não existe aqui.
- **Acessibilidade**: `accessibilityRole` em todo controle, `accessibilityLabel` em todo
  alvo sem texto visível, `accessibilityState` para `disabled`/`busy`/`selected`. A
  mensagem de erro de um campo entra no `accessibilityLabel` dele — não existe
  `aria-describedby`, e sem isso o leitor anuncia "inválido" sem o motivo.
- **Tema**: claro é canônico na N1; não adicionar alternância.

## Regras do RF08 que a arquitetura já cobra

- **Sem cópia local do gabarito, não se confirma correção.** `enfileirarCorrecao` devolve
  vazio nesse caso; não contorne isso numa tela.
- **Todo item da fila nasce com identificador gerado no dispositivo** e com status
  `pending`. Não marque nada como `synced` — nada é enviado nesta fase.
- **A fila não persiste** entre execuções, e a tela precisa dizer isso. Não apresente
  persistência local como sincronização.

## Fora de escopo da N1

Câmera, leitura real de QR Code, processamento de imagem, sincronização real e
autenticação real. Quando uma tela precisar de um desses, represente o estado com dado
estático e deixe o ponto de integração explícito no código —
ver `.claude/rules/00-escopo-n1.md`.

## Fechamento

- `npm run lint --workspace @sgp/mobile` e `git diff --check`.
- `npm run typecheck --workspace @sgp/mobile` **falha hoje** por um problema de
  configuração de tipos anterior a esta arquitetura, tratado em issue própria; não
  conclua que foi a sua alteração sem antes conferir o mesmo erro na `main`.
- Atualizar `docs/design/experiencia-mobile-atual.md` quando o comportamento executável
  mudar, e `design-system-mobile.md` quando nascer um padrão novo reutilizável.
- Não crie commit sem pedido explícito; quando pedirem, siga
  `.claude/rules/30-convencao-de-commits.md`.
