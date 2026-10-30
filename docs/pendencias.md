# Pendencias

Pontos que os documentos recebidos nao resolvem, ou nos quais as fontes divergem entre
si. Nenhum item aqui e decisao: sao perguntas em aberto.

Cada divergencia esta registrada com o que cada fonte diz, sem escolher uma como valida.
Uma fonte ser mais recente e evidencia cronologica, nao autorizacao para substituir a
outra.

Quando um item for resolvido, a decisao vai para `docs/decisoes/` com a evidencia
correspondente, e sai desta lista.

## Divergencias entre fontes

| #   | Tema             | O que cada fonte diz                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Pesos da N1      | A metodologia indica 25% para cada um dos quatro criterios. O documento de escopo indica 10% para o codigo-fonte, 20% para o sistema hospedado, 20% para o README e 50% para o diario individual com PRs.                                                                                                                                                                            |
| 2   | UML na N1        | A metodologia inclui casos de uso e diagrama de classes na N1. O documento de escopo pede esboco inicial de classes. O modelo de README posiciona UML na N2.                                                                                                                                                                                                                         |
| 3   | Stack do backend | A especificacao do produto descreve NestJS ou Fastify para a API. Os documentos da disciplina apresentam Node.js com Express e MySQL como stack obrigatoria. Proposta em andamento na [issue #66](https://github.com/Catolica-Tech-Academy-Hub/sgp-catolica/issues/66): NestJS sobre Express com MySQL, ja implementada em `apps/api`, aguardando o acordo da equipe para virar ADR. |

## Definicoes ausentes

| #   | Tema                                                | Situacao                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4   | Recorte de telas da N1                              | Nenhum documento aprovado define quais telas formam o conjunto minimo da entrega. A N1 exige telas principais navegaveis, sem enumerar quais. As issues da [milestone N1](https://github.com/LeoAnders/sgp-catolica/milestone/1) sao hoje um recorte de trabalho concreto, mas ainda nao foram validadas pela equipe nem pela professora como o escopo final.                                                      |
| 5   | Recorte da N3                                       | Nenhum documento define quais das funcionalidades precisam estar completas na entrega final.                                                                                                                                                                                                                                                                                                                       |
| 6   | Avaliacao do aplicativo mobile                      | O criterio de avaliacao fala em sistema web hospedado. Nao esta definido como o aplicativo do professor entra na demonstracao ou na nota.                                                                                                                                                                                                                                                                          |
| 7   | Data da demonstracao da N3                          | A metodologia define as entregas em 11/09/2026, 23/10/2026 e 27/11/2026. A data da demonstracao da N3 consta como a combinar.                                                                                                                                                                                                                                                                                      |
| 8   | Servico de hospedagem                               | Nao definido. O criterio aceita hospedagem gratuita, sem indicar qual. Acompanhado pela [issue #29](https://github.com/LeoAnders/sgp-catolica/issues/29).                                                                                                                                                                                                                                                          |
| 9   | Ferramenta de backlog                               | Os documentos exigem Issues no repositorio e aceitam ferramenta externa com visualizacao publica sem login, sem indicar qual. Desde 2026-08-26 o projeto usa Issues junto de um [GitHub Project publico](https://github.com/users/LeoAnders/projects/11), que atende ao criterio na pratica; falta a equipe formalizar isso como decisao em `docs/decisoes/`.                                                      |
| 10  | Nomenclatura de decisoes                            | O modelo de README pede uma pasta `docs/adr/`. Este repositorio usa `docs/decisoes/`. Falta decidir se renomeia.                                                                                                                                                                                                                                                                                                   |
| 11  | Regras criticas de negocio                          | RNF09 exige cobertura minima de testes nas regras criticas, sem enumerar quais compoem esse conjunto.                                                                                                                                                                                                                                                                                                              |
| 16  | Relacao entre a pontuacao da questao e a da prova   | RF02 da a questao discursiva uma pontuacao maxima propria; RF04 da a prova uma pontuacao individual por questao e diz que a soma nao e validada pelo sistema. Nenhuma fonte diz se o valor atribuido na prova pode divergir do valor da questao, nem qual dos dois prevalece. Nos tipos isso corresponde a `Questao.maxScore` e `QuestaoDaProva.score`.                                                            |
| 17  | Ordem das alternativas quando nao ha embaralhamento | RF06 exige que a ordem embaralhada seja materializada e persistida na geracao, sem o que o aplicativo nao consegue interpretar a marcacao. Nenhuma fonte diz se essa ordem deve ser gravada tambem quando o embaralhamento de alternativas esta desligado, ou se nesse caso vale a ordem de cadastro da questao. Nos tipos isso corresponde a `LayoutVersao.alternativeOrder` e `VersaoProva.shuffleAlternatives`. |

> Os itens 16 e 17 nasceram da auditoria de coerencia dos dados de exemplo
> (`npm run audit:mocks`), que precisou de uma leitura provisoria para conseguir
> validar os mocks: hoje ela aceita que o valor da questao na prova seja
> independente da pontuacao maxima da questao, e que a ordem de cadastro valha
> quando nao ha embaralhamento. Sao leituras de trabalho, nao decisoes; quando a
> equipe definir os dois pontos, a auditoria e os mocks acompanham.

## Pedidos do cliente nao incorporados como criterio de aceite

Itens levantados pelo cliente na entrevista que a especificacao do produto nao converteu
em criterio de aceite. Precisam de validacao antes de entrar no escopo.

| #   | Pedido                                            | Observacao                                                                                                   |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 12  | Importar lista de alunos por planilha             | A especificacao preve matricula por e-mail e por codigo de convite (RF03).                                   |
| 13  | Exportar no formato aceito pelo sistema academico | Falta a definicao das colunas que o sistema academico aceita.                                                |
| 14  | Gerar a prova em formato editavel de texto        | Motivado por ajuste de layout, para evitar questao cortada entre paginas.                                    |
| 15  | Estatistica de qual alternativa foi mais marcada  | O cliente trata como diferencial pedagogico. Nao aparece de forma explicita nos criterios de aceite de RF10. |
