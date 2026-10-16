# SGP Catolica

Sistema de Geracao de Provas. Monorepo com a aplicacao web, o aplicativo mobile do
professor e os pacotes compartilhados entre os dois.

## Stack alinhada com a especificacao

- A aplicacao web deve seguir **Vite + Vue**, conforme a especificacao v1.10 e o
  alinhamento confirmado em 2026-08-17.
- O scaffold web foi migrado de React para Vue em 2026-08-17. Nao reintroduzir React
  na aplicacao web.
- O mobile segue **React Native / Expo**, como descrito na especificacao.
- Os documentos da disciplina apresentam **Node.js + Express + MySQL** como stack
  obrigatoria, enquanto a spec descreve **NestJS ou Fastify** para a API. Essa
  divergencia de backend continua aberta e nao deve ser resolvida por inferencia.
  A proposta em andamento (issue #66) e **NestJS sobre Express com MySQL e Prisma**,
  ja em `apps/api`; ela so vira decisao com ADR em `docs/decisoes/`.

## Fase atual: N1 — interfaces navegaveis

- O objetivo da fase e ter telas navegaveis (a tela A leva a tela B) com dados
  estaticos, para o cliente visualizar o sistema tomando forma.
- Nao ha banco de dados, backend real, autenticacao real ou infraestrutura de
  orquestracao nesta fase.
- Todo dado exibido vem de `packages/mocks`. Nenhuma tela faz requisicao de rede.
  Excecao em andamento (issue #66): com `VITE_API_URL` definida, turmas, matriculas,
  estudantes e o banco de questoes vem da API, sempre pelos modulos
  `apps/web/src/lib/estado-*.ts`, nunca de dentro de uma tela.
- Arquitetura simples e direta, sem camadas de abstracao antecipadas, mas organizada
  para que o backend possa ser ligado depois sem reescrever as telas.

## Estrutura

```
apps/web       aplicacao web em Vite + Vue, para professor e estudante
apps/mobile    aplicativo do professor (React Native), correcao de provas
apps/api       API em NestJS com MySQL via Prisma (proposta da issue #66, ver docs/api)
packages/design-tokens  tokens visuais compartilhados (cores, espacamento, tipografia)
packages/mocks          dados estaticos da fase N1
packages/shared-types   tipos do dominio, derivados da especificacao
docs                    documentacao oficial do projeto
```

## Documentacao

A documentacao oficial esta em `docs/`, indexada por [`docs/README.md`](docs/README.md):
requisitos funcionais com criterios de aceite, requisitos nao funcionais, dicionario de
entidades e pendencias em aberto. Comece por la.

Este repositorio e a unica raiz esperada para o desenvolvimento. A documentacao
versionada deve ser suficiente para o trabalho cotidiano e manter rastreabilidade aos
documentos originais fornecidos ou a aprovacoes formalmente registradas. Anotacoes
pessoais externas nao sao fonte de requisitos nem contexto esperado e nao devem ser
citadas por caminho ou copiadas para ca.

## Como trabalhar aqui

- Tipos de dominio ficam em `packages/shared-types` e sao a referencia unica; eles
  seguem a especificacao do cliente e nao devem ser inventados caso a caso.
- Dados de exemplo ficam em `packages/mocks`, nunca embutidos dentro de uma tela.
- Valores visuais (cor, espacamento, raio, fonte) nunca sao literais espalhados no
  codigo. Na web, o tema e os tokens semanticos vem de
  `apps/web/src/styles/global.css`, conforme o
  [design system web](docs/design/design-system-web.md). No mobile, vem de
  `packages/design-tokens`.
- O idioma do dominio e o portugues (turma, prova, aplicacao, correcao, questao).
- Comentarios e documentacao em portugues.

## Limites do repositorio

Este repositorio e compartilhado com a equipe e sera publico. Nao inclua:

- caminhos absolutos de maquinas locais;
- arquivos de workspace, configuracao pessoal de editor ou de ferramentas de anotacao
  individuais;
- credenciais, tokens ou dados pessoais reais de estudantes.

## Decisoes

`docs/decisoes/` registra apenas decisoes ja acordadas pela equipe. Propostas
individuais e ideias em estudo nao entram no repositorio antes disso: descreva a
proposta no PR ou na issue correspondente e traga para `docs/` depois do acordo.

Regras adicionais em `.claude/rules/`.
