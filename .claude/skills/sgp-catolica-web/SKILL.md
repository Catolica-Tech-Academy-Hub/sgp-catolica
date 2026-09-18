---
name: sgp-catolica-web
description: Padroes obrigatorios para criar ou revisar telas da aplicacao web do SGP Catolica (apps/web, Vue + Tailwind v4 + shadcn-vue). Use ao implementar tela, ajustar UI, revisar layout, tema, paleta, componentes, acessibilidade ou estados de carregamento, vazio e erro na web.
---

# UI da web do SGP Católica

Aplicação acadêmica sóbria e consistente, inspirada na densidade e na hierarquia por
superfícies do workspace do Typeform (sem copiar marca, logotipo ou componentes
proprietários). Aqui não se cria identidade visual nova: a fundação já está decidida e
documentada.

## Fonte de verdade

Leia antes de escrever código de tela — não deduza padrão a partir de uma tela isolada:

| Documento                                                                             | Quando                                                                                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [docs/design/design-system-web.md](../../../docs/design/design-system-web.md)         | Tokens, superfícies, paleta, tipografia, casca, layout, editor, controles, estados e checklist de tela. |
| [docs/design/experiencia-web-atual.md](../../../docs/design/experiencia-web-atual.md) | Rotas existentes, situação de cada uma (implementada/marcador/protótipo) e limites do que já funciona.  |
| [docs/design/README.md](../../../docs/design/README.md)                               | Índice de design.                                                                                       |

`apps/web/src/telas/Provas.vue` e `apps/web/src/telas/Aplicacoes.vue` são referências
executáveis do padrão de seção (painel esquerdo + lista de cartões); `Aplicacoes.vue`
também é a referência para detalhe somente leitura em Dialog, e
`apps/web/src/telas/Correcoes.vue` para fila de trabalho em `Table`/`Card` com Dialog de
escolha que mostra o candidato impedido em vez de escondê-lo. `apps/web/src/components/casca/`
é a referência da casca autenticada. O tema vive em `apps/web/src/styles/global.css`. Um padrão novo e
reutilizável exige atualizar `docs/design/design-system-web.md` na mesma entrega.

## Antes de desenhar uma tela

1. Requisito e critérios de aceite: [docs/produto/requisitos-funcionais.md](../../../docs/produto/requisitos-funcionais.md).
2. Domínio: [docs/modelo-dados/dicionario-de-entidades.md](../../../docs/modelo-dados/dicionario-de-entidades.md) e os tipos de `packages/shared-types`; não invente campo nem entidade.
3. Rota e situação: `apps/web/src/router/index.ts` e o mapa de navegação da experiência atual — várias seções ainda são marcadores, e marcador não deve ganhar controle que finja funcionar.
4. Dados: somente `packages/mocks`. Nenhuma tela faz requisição de rede na fase N1.
5. Aberto em [docs/pendencias.md](../../../docs/pendencias.md) não se resolve por inferência.

## Limites que não se negociam

- **Componentes**: use os primitivos de `@/components/ui` (Button, Input, Textarea,
  Select, Switch, Dialog, DropdownMenu, Card, Table, Alert, Badge, Tooltip, Skeleton,
  Breadcrumb, Avatar, Separator, Sheet, Tabs, Sonner). Faltando um, adicione pelo CLI do
  shadcn-vue com `apps/web/components.json`; nunca recrie um à mão. `components/ui/sidebar`
  é resíduo do layout anterior ao redesign — não está em uso e não deve ser reaproveitado.
- **Casca**: `apps/web/src/components/casca/` (`BarraSuperior`, `AbasDeSecao`,
  `PainelDaSecao`, `ItemDeRecorte`). A casca serve as **duas** perspectivas: o professor
  com abas de seção, e o estudante (`meta.casca: 'estudante'`) com a mesma barra externa
  e sem abas. `BarraSuperior` se configura por props; não criar uma segunda barra — barra externa branca de 56 px (marca à esquerda,
  utilidades à direita) + moldura arredondada `bg-field` com abas horizontais de 48 px
  dentro dela. **Não existe sidebar global**; navegação de seção vive nas abas, nunca
  atrás de ícone sem rótulo. Seções comuns não usam breadcrumb — aba ativa e título já
  dão contexto. Login e editor saem da casca via `meta.telaCheia` e compõem a própria
  tela inteira.
- **Tema**: claro é canônico na N1. Tokens escuros são preservados no CSS, mas **não há
  alternância exposta** — não adicionar toggle de tema.
- **Paleta**: só tokens semânticos — `background` (margem externa), `field` (campo de
  trabalho), `card` (objeto elevado), `popover` (overlay), `sheet`/`sheet-foreground`/
  `sheet-border` (papel da prova, sempre claro), `primary`, `secondary`/`accent`
  (seleção discreta), `destructive` (remoção/erro). Sem hex, cor arbitrária, sombra ou
  raio manual. **Nunca usar degradê** em cartões, métricas, painéis ou cabeçalhos —
  toda superfície comum é neutra; cor pontual fica em ação primária, foco e indicador
  ativo.
- **Tipografia**: Instrument Sans Variable (fallback `system-ui`), não Inter. Texto
  operacional em 14 px/400; peso 500 domina a hierarquia; `font-semibold`/`font-bold`
  reservados a número da questão, total e gabarito.
- **Layout de seção**: painel esquerdo de 256 px (ação principal → busca → recortes com
  contagem → rodapé de apoio) + conteúdo flexível; em largura estreita o painel vira
  faixa acima do conteúdo. Se a linha é o objeto que abre, lista de cartões clicáveis
  (sem menu de linha concorrente); se os registros são comparados por coluna, `Table`
  em `Card`. `min-w-0` no contêiner e `overflow-x-auto` só no trecho que excede a
  largura.
- **Estados**: `Skeleton` no carregamento, vazio com motivo e ação recuperável quando
  existir, erro explicando o que fazer, `vue-sonner` para confirmação e "Desfazer" em
  remoção reversível. Validação junto ao campo, com `aria-invalid` e foco preservado.
- **Acessibilidade**: "Ir para o conteúdo", foco visível preservado, hierarquia de
  títulos, nome acessível em todo controle (ícone só decorativo com `aria-hidden`,
  `Button` apenas com ícone sempre com `aria-label` ou tooltip), `aria-current` na aba
  ativa e `aria-pressed` em filtro/seleção.
- **Responsividade**: verificar largura estreita (abaixo de `sm` e de `lg`) e teclado
  antes de concluir; abas e áreas de trabalho rolam sem exibir barra de rolagem nativa
  competindo com a borda do painel.

## Fechamento

- `npm run typecheck --workspace @sgp/web`, `npm run build --workspace @sgp/web`,
  `npm run lint --workspace @sgp/web` e `git diff --check`.
- Atualizar `docs/design/experiencia-web-atual.md` quando o comportamento executável
  mudar, e `docs/design/design-system-web.md` quando nascer um padrão novo reutilizável
  — na mesma entrega, não depois.
- Não crie commit sem pedido explícito do usuário; quando pedirem, siga
  `.claude/rules/30-convencao-de-commits.md`. O hook `commit-msg` (commitlint) e o CI
  já verificam o padrão — não é preciso lembrar manualmente.

## Relação com as outras skills

- `frontend-design` busca identidade visual distintiva e escolhas autorais de paleta e
  tipografia: **não se aplica** a `apps/web`, cuja fundação (Instrument Sans Variable,
  tema shadcn, aubergine institucional) já está decidida. Use-a apenas fora deste app.
- `web-design-guidelines` serve como revisão externa de acessibilidade e UX; em conflito,
  `docs/design/` prevalece.
