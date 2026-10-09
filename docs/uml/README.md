# Diagramas UML

Diagramas UML do SGP Católica, feitos na N2 (atividade Parte 1). Cada documento traz o
passo a passo da construção, do levantamento dos elementos até a versão final, e liga o
diagrama aos [requisitos funcionais](../produto/requisitos-funcionais.md).

| Diagrama    | O que mostra                                                                   | Documento                        |
| ----------- | ------------------------------------------------------------------------------ | -------------------------------- |
| Caso de uso | Quem usa o sistema e para quê                                                  | [caso-de-uso.md](caso-de-uso.md) |
| Atividade   | A ordem do processo de aplicar e corrigir uma prova, com raias por responsável | [atividade.md](atividade.md)     |
| Classe      | A estrutura do domínio: classes, atributos, operações e associações            | [classe.md](classe.md)           |
| Sequência   | As mensagens trocadas na correção pelo aplicativo e na sincronização (RF08)    | [sequencia.md](sequencia.md)     |

## Notação

Os diagramas são escritos em [Mermaid](https://mermaid.js.org/) dentro do próprio
Markdown. O GitHub desenha o diagrama ao abrir o arquivo, e uma alteração aparece no diff
como texto. O Mermaid não tem um tipo próprio para alguns diagramas UML. Nesses casos, o
documento explica a convenção usada e traz uma legenda.

## Escopo

Os diagramas modelam o comportamento e o domínio descritos na especificação (v1.10). Não
modelam a implementação da N1, que usa dados estáticos e simula câmera, QR Code e
sincronização.

Pontos que as fontes não resolvem continuam em [pendências](../pendencias.md). Os
diagramas não os decidem.
