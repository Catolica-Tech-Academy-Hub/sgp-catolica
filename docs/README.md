# Documentacao do projeto

Indice da documentacao oficial do SGP Catolica. O que esta aqui vale como fonte para a
equipe; rascunhos e ideias em discussao ficam fora do repositorio ate serem acordados.

Este arquivo e o ponto de entrada da documentacao do projeto.

## Documentos disponiveis

| Documento                                                          | Conteudo                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------- |
| [Visao do produto](produto/visao-do-produto.md)                    | Problema que o sistema resolve e publico atendido             |
| [Requisitos funcionais](produto/requisitos-funcionais.md)          | Os 12 requisitos com criterios de aceite                      |
| [Requisitos nao funcionais](produto/requisitos-nao-funcionais.md)  | Os 9 requisitos de qualidade e restricao                      |
| [Dicionario de entidades](modelo-dados/dicionario-de-entidades.md) | Entidades do dominio e correspondencia com os tipos do codigo |
| [Pendencias](pendencias.md)                                        | Divergencias entre fontes e definicoes ainda ausentes         |
| [Design system web](design/design-system-web.md)                   | Padroes de UI, componentes, temas e paleta                    |
| [Experiencia web atual](design/experiencia-web-atual.md)           | Mapa de telas, navegacao e fluxos implementados               |
| [Design system mobile](design/design-system-mobile.md)             | Padroes de UI do aplicativo do professor                      |
| [Experiencia mobile atual](design/experiencia-mobile-atual.md)     | Mapa de telas e arquitetura do aplicativo                     |
| [Prints das telas](telas/README.md)                                | Convencao de nome e captura dos prints referenciados aqui     |

## Por onde comecar

- Para entender **o que o sistema faz**: visao do produto, depois requisitos funcionais.
- Para **implementar uma tela ou regra**: requisitos funcionais, depois o dicionario de
  entidades, e os tipos em `packages/shared-types`.
- Para **projetar ou revisar UI/UX**: design system web, depois experiencia web atual.
  No aplicativo do professor, design system mobile e experiencia mobile atual.
- Para saber **o que ainda nao esta decidido**: pendencias. Nada ali deve ser tratado
  como definido.

## Estrutura das pastas

| Pasta           | Conteudo                                           | Situacao                                                 |
| --------------- | -------------------------------------------------- | -------------------------------------------------------- |
| `produto/`      | Visao do produto, requisitos e escopo de cada fase | em uso                                                   |
| `modelo-dados/` | Dicionario de entidades; MER/DER a partir da N2    | em uso                                                   |
| `decisoes/`     | Registro das decisoes ja tomadas pela equipe       | vazio                                                    |
| `design/`       | Design system, mapa de telas e fluxos de navegacao | em uso                                                   |
| `telas/`        | Prints das telas, referenciados pelo README        | em uso (convencao em [telas/README.md](telas/README.md)) |
| `uml/`          | Diagramas de casos de uso, classes e atividades    | vazio                                                    |
| `arquitetura/`  | Diagramas de arquitetura e camadas                 | vazio                                                    |
| `api/`          | Especificacao de endpoints e colecoes de teste     | vazio                                                    |

As demais pastas vazias entram no repositorio com um `.gitkeep` e sao preenchidas
conforme as fases avancam. O mapa de telas e os fluxos atualmente implementados estao em
[design/experiencia-web-atual.md](design/experiencia-web-atual.md). A nomenclatura de
`decisoes/` ainda depende do item sobre `docs/adr/` em [pendencias](pendencias.md).

O modelo de README da disciplina preve a documentacao de API a partir da N2.
