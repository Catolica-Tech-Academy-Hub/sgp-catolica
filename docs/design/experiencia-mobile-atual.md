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

| Rota       | Situação           | Experiência atual                                                           |
| ---------- | ------------------ | --------------------------------------------------------------------------- |
| `Ambiente` | Implementado na N1 | Valida a arquitetura: navegação, tokens sincronizados, primitivos e estado. |

As telas do fluxo de correção (RF08) entram nas entregas seguintes e substituem
`Ambiente` como rota inicial.

## Arquitetura

| Camada     | Onde vive                        | Papel                                               |
| ---------- | -------------------------------- | --------------------------------------------------- |
| Raiz       | `App.tsx`                        | Só a casca: área segura, barra de status e o stack. |
| Navegação  | `src/navegacao/index.tsx`        | Stack e tipos das rotas.                            |
| Telas      | `src/telas/`                     | Uma tela por arquivo; a composição fica nela.       |
| Primitivos | `src/components/ui/`             | Botão, Cartão, Campo, Rótulo, Badge e Tela.         |
| Estado     | `src/lib/estado-de-correcoes.ts` | Ponto único de integração quando a API existir.     |

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
- **Sem câmera, sem QR Code, sem leitura de imagem.** Fora do escopo da N1
  (`.claude/rules/00-escopo-n1.md`). A seleção da prova a corrigir é feita por escolha na
  lista, que produz o mesmo efeito de uma leitura: chegar a uma versão e, quando há
  identificação, a um aluno.
- **Sem autenticação real.** Como na web, a entrada valida formato e abre o protótipo.
- **A fonte Instrument Sans não é carregada.** O pacote da web distribui só `.woff2`, que
  o React Native não aceita; o aplicativo usa a fonte do sistema. Ver a limitação
  registrada no design system mobile.
- **`npm run typecheck --workspace @sgp/mobile` não passa.** É uma falha de configuração
  de tipos anterior a esta arquitetura (o mesmo erro ocorre no `App.tsx` de scaffold) e
  está sendo tratada em issue própria. O CI não a detecta porque só roda commitlint,
  format e lint.

## Como rodar

```bash
npm run mobile            # expo start
npm run lint --workspace @sgp/mobile
```

O aplicativo também sobe no navegador (`expo start --web`), com `react-dom` e
`react-native-web` instalados. Isso não substitui o teste em dispositivo, mas permite ver
as telas sem emulador — e, como a N1 não tem módulo nativo de câmera, nada quebra no
build web.
