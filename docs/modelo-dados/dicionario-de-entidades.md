# Dicionario de Entidades

Entidades do dominio descritas pela especificacao do produto (v1.10) e sua
correspondencia com os tipos em `packages/shared-types`.

Os nomes das entidades seguem a especificacao, em ingles. Os tipos no codigo seguem o
idioma do dominio adotado no repositorio, em portugues. Um arquivo de tipos agrupa mais
de uma entidade quando elas pertencem ao mesmo assunto.

A correspondencia indica qual tipo representa cada entidade no scaffold atual; nao
significa paridade completa de campos, pois os tipos ainda refletem a fase N1.

## Correspondencia

| Entidade        | Tipo no codigo                         | Arquivo       |
| --------------- | -------------------------------------- | ------------- |
| User            | `Usuario` (e `Professor`, `Estudante`) | `usuario.ts`  |
| RefreshToken    | —                                      | —             |
| Class           | `Turma`                                | `turma.ts`    |
| ClassEnrollment | `Matricula`                            | `turma.ts`    |
| Question        | `Questao`                              | `questao.ts`  |
| Exam            | `Prova`                                | `prova.ts`    |
| Application     | `Aplicacao`                            | `prova.ts`    |
| ExamVersion     | `VersaoProva`                          | `prova.ts`    |
| ExamAssignment  | `AtribuicaoVersao`                     | `prova.ts`    |
| Correction      | `Correcao`                             | `correcao.ts` |

`RefreshToken` ainda nao tem tipo correspondente. A autenticacao real nao faz parte da
N1, e os documentos recebidos nao definem em qual entrega ela deve existir.

## User

Base comum de professor e estudante.

Campos: identificador, papel (`professor` ou `estudante`), nome completo, e-mail, hash da
senha, data de criacao e data de anonimizacao quando houver.

- E-mail unico no sistema, com dominio validado pelo papel (RF01)
- A data de anonimizacao e preenchida por RF01.1

## RefreshToken

Token de renovacao de sessao, por dispositivo.

Campos: identificador, usuario, hash do token, informacao do dispositivo, data de
emissao, data de expiracao e data de revogacao quando houver.

- O logout comum revoga apenas o token do dispositivo atual
- Sair de todos os dispositivos revoga todos os tokens ativos do usuario
- A informacao do dispositivo identifica a sessao no fluxo de sair de todos os
  dispositivos

## Class

Turma. Chamada `Class` na especificacao e "turma" na interface.

Campos: identificador, professor, nome, disciplina, periodo letivo, situacao
(`active` ou `archived`), codigo de convite e data de criacao.

- Codigo de convite unico e regeneravel; regenerar invalida o anterior imediatamente
- Arquivar e exclusao logica: preserva as aplicacoes associadas

## ClassEnrollment

Matricula de um estudante em uma turma.

Campos: identificador, turma, estudante, data de matricula, situacao (`active` ou
`removed`) e origem da matricula (`teacher` ou `invite_code`).

- A origem da matricula da rastreabilidade de como o estudante entrou
- Remover o estudante da turma nao apaga notas ja lancadas
- O mesmo codigo de convite usado duas vezes nao duplica a matricula

## Question

Questao do banco do professor.

Campos: identificador, professor, tipo (`objetiva` ou `discursiva`), enunciado, tags,
alternativas quando objetiva, alternativa correta, pontuacao maxima quando discursiva e
data de exclusao logica.

- Objetiva: de 2 a 5 alternativas, com exatamente uma correta
- Discursiva: pontuacao maxima
- O enunciado aceita Markdown basico

## Exam

Prova: conteudo reutilizavel, sem vinculo com turma.

Campos: identificador, professor, titulo, descricao, lista de questoes com ordem e
pontuacao individual, situacao (`draft`, `ready` ou `closed`) e data de criacao.

- Ate 20 questoes; a soma das pontuacoes nao e validada pelo sistema
- A transicao de `draft` para `ready` e efeito da primeira aplicacao criada
- `closed` bloqueia novas aplicacoes; a prova permanece listada

## Application

Aplicacao: uma prova aplicada a uma turma. Tudo que vem depois se refere a ela.

Campos: identificador, prova, turma, professor, situacao (`draft`, `generated` ou
`closed`), endereco do PDF e data de criacao.

- O PDF e o arquivo unico consolidado, sobrescrito a cada regeneracao
- A mesma prova gera aplicacoes independentes por turma ou por reaplicacao

## ExamVersion

Versao impressa de uma aplicacao. E onde o embaralhamento fica materializado.

Campos: identificador, aplicacao, numero da versao, indicadores de embaralhamento de
questoes e de alternativas, indicador de identificacao do estudante, layout impresso,
situacao de publicacao do gabarito, codigo publico, conteudo do QR Code e data de
criacao.

- Os indicadores dizem **se** embaralha; o layout grava **como** ficou. Sem o layout, o
  aplicativo nao sabe a qual alternativa corresponde a letra marcada
- O codigo publico atende a rota publica de gabarito; o conteudo do QR Code e de uso
  exclusivo do aplicativo do professor

## ExamAssignment

Existe somente quando a versao foi gerada com identificacao do estudante. Liga estudante
e versao.

Campos: identificador, versao, estudante e conteudo do QR Code.

- O QR Code aqui e especifico do estudante, e e o que permite a nota automatica

## Correction

Correcao confirmada. E a entidade da nota.

Campos: identificador, versao, estudante quando atribuido, nome e matricula relatados
quando a prova foi anonima, resultados objetivos, notas discursivas, nota total,
observacoes, data de confirmacao, autor da correcao, indicador de atribuicao automatica,
identificador gerado no dispositivo e situacao de sincronizacao (`pending`, `synced` ou
`error`).

- Sem estudante atribuido, a correcao fica pendente de lancamento manual (RF09)
- O identificador gerado no dispositivo garante deduplicacao idempotente
- Atribuir o estudante preenche o registro existente; nunca cria outro

## Modelo fisico

O esquema do banco (MySQL) esta em `apps/api/prisma/schema.prisma`, com as migracoes em
`apps/api/prisma/migrations/` (ver [API](../api/README.md)). Os modelos e campos usam os
mesmos nomes dos tipos de `@sgp/shared-types`. Diferencas em relacao a este dicionario:

- `RefreshToken` ainda nao tem tabela; entra com a autenticacao.
- A alternativa de questao objetiva vira tabela propria (`alternativas`), com a ordem
  de cadastro e chave composta por questao e alternativa.
- A lista de questoes da prova vira a tabela `questoes_da_prova`, com ordem e pontuacao.
- `provas.blocos` (JSON, opcional) guarda o layout do editor por blocos, prototipo da
  issue #12 que nao faz parte deste dicionario. E nele que fica a questao criada dentro
  da prova e ainda nao salva no banco, por isso ela nao aparece em `questoes_da_prova`.
- Layout da versao, resultados objetivos e notas discursivas ficam em colunas JSON:
  sao lidos e gravados inteiros, nunca consultados por partes.

## Tipos que nao sao entidades

`relatorio.ts` reune projecoes de leitura usadas pelos relatorios e pelo historico do
estudante: estatisticas por aplicacao, estatisticas por questao e nota do estudante.
Sao dados derivados, calculados a partir das entidades acima, e por isso nao aparecem
neste dicionario.

`correcao.ts` tambem define tipos auxiliares que nao sao entidades proprias:
`GabaritoObjetivo`, `GabaritoDiscursivo` e `GabaritoVersaoSnapshot` sao copias do
gabarito de uma versao, usadas pelo aplicativo do professor para corrigir offline
(RF08); `ItemFilaCorrecao` e o item da fila local de correcao antes da sincronizacao.
Nenhum dos quatro tem identidade propria fora desse papel auxiliar.
