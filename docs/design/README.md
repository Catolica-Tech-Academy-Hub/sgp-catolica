# Design

Fonte oficial das decisões de interface e experiência do SGP Católica, nas duas
superfícies: a aplicação web e o aplicativo do professor. Estes documentos descrevem a
base consolidada na N1 e devem acompanhar qualquer mudança relevante de UI.

## Documentos

| Documento                                               | Responsabilidade                                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [Design system web](design-system-web.md)               | Regras normativas: direção visual, tokens, tipografia, densidade, layouts, componentes, acessibilidade e padrões do editor.  |
| [Experiência web atual](experiencia-web-atual.md)       | Estado executável: rotas, fluxos, comportamentos, persistência local e limites conhecidos.                                   |
| [Design system mobile](design-system-mobile.md)         | Regras do aplicativo do professor: como a linguagem da web é mapeada para o celular, e onde os dois se afastam de propósito. |
| [Experiência mobile atual](experiencia-mobile-atual.md) | Estado executável do aplicativo: rotas, arquitetura, regras do RF08 já respeitadas e limites.                                |

O design system responde **como novas interfaces devem ser construídas**. A experiência
atual responde **o que já funciona hoje**. O mobile não tem linguagem própria: ele mapeia
a da web, e os tokens compartilhados em `packages/design-tokens` são a costura entre as
duas. Requisitos de produto continuam em
[`docs/produto`](../produto/); estes arquivos não criam requisitos funcionais por conta
própria.

## Referências adotadas

- [Typeform](https://www.typeform.com/) orienta a densidade, a hierarquia por superfícies,
  a casca branca ao redor do campo cinza, os controles compactos e a organização do
  workspace. A marca e os componentes não são copiados literalmente.
- O modo de apresentação do Figma orienta a pré-visualização imersiva da prova: canvas,
  folha centralizada e controles flutuantes de zoom.
- A ilustração do login é uma adaptação rastreada em
  [`apps/web/src/assets/illustrations/README.md`](../../apps/web/src/assets/illustrations/README.md).

## Regra de manutenção

1. Confirmar requisitos e limites da fase antes de alterar um fluxo.
2. Atualizar primeiro o design system quando surgir um padrão reutilizável.
3. Atualizar a experiência atual quando uma tela ou comportamento mudar.
4. Manter propostas não aprovadas explicitamente marcadas como protótipo ou limite.
5. Validar links, `git diff --check`, typecheck e build antes de concluir a entrega.

Não registrar aqui anotações pessoais, caminhos locais, credenciais ou dados reais.
