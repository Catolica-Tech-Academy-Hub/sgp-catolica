# API do SGP

API em `apps/api` (pacote `@sgp/api`): **NestJS** sobre Express, com **Prisma** como ORM
e **MySQL 8.4**. Introduzida pela
[issue #66](https://github.com/Catolica-Tech-Academy-Hub/sgp-catolica/issues/66).

> A stack ainda é uma **proposta**: ela responde ao item 3 das
> [pendências](../pendencias.md) (NestJS na especificação; Node.js + Express + MySQL nos
> documentos da disciplina) e vira ADR em `docs/decisoes/` depois do acordo da equipe.

## Rodar localmente

Requer Docker (para o MySQL) além do Node.js do projeto.

```bash
docker compose up -d                          # MySQL em localhost:3306
cp apps/api/.env.example apps/api/.env        # conexão com o MySQL local
npm run db:deploy --workspace @sgp/api        # aplica as migrações
npm run db:seed --workspace @sgp/api          # popula com os dados de @sgp/mocks
npm run api                                   # API em http://localhost:3000
```

Para a web usar a API em vez dos dados de demonstração:

```bash
cp apps/web/.env.example apps/web/.env.local  # VITE_API_URL=http://localhost:3000
npm run web
```

Sem `VITE_API_URL`, a web continua no modo de demonstração local (mocks e
`localStorage`), que é o que a versão hospedada usa enquanto a API não tem hospedagem
(item 8 das pendências).

| Script (`--workspace @sgp/api`) | O que faz                                                  |
| ------------------------------- | ---------------------------------------------------------- |
| `dev`                           | API com recarga automática (`npm run api` na raiz)         |
| `build` / `start`               | Compila para `dist/` e roda a versão compilada             |
| `db:migrate`                    | Cria uma migração nova a partir de mudanças no esquema     |
| `db:deploy`                     | Aplica as migrações pendentes                              |
| `db:seed`                       | Apaga os dados e repopula com `@sgp/mocks`                 |
| `db:reset`                      | Apaga o banco inteiro, reaplica as migrações e roda o seed |

## Organização

| Onde                     | Papel                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `prisma/schema.prisma`   | Modelo físico, derivado do [dicionário de entidades](../modelo-dados/dicionario-de-entidades.md) |
| `prisma/migrations/`     | Migrações versionadas                                                                            |
| `prisma/seed.ts`         | Seed a partir de `@sgp/mocks`                                                                    |
| `src/<assunto>/`         | Um módulo Nest por assunto: controller, service, DTOs e mapeadores                               |
| `src/prisma/`            | Conexão com o MySQL (adaptador `mariadb`, compatível com MySQL)                                  |
| `src/professor-atual.ts` | Professor fixo (`prof-1`) até existir autenticação                                               |

Os modelos e campos do Prisma seguem os nomes de `@sgp/shared-types`, e as respostas
têm exatamente esse formato: as telas consomem a API sem tradução campo a campo.

## Endpoints

Todos atuam sobre os dados do professor atual. Erros seguem o formato do Nest
(`{ statusCode, message, error }`), com `message` em lista quando a validação encontra
mais de um problema.

### Saúde

| Método | Caminho  | Resposta                        |
| ------ | -------- | ------------------------------- |
| GET    | `/saude` | `{ status: 'ok', banco: 'ok' }` |

### Turmas e matrículas (RF03)

| Método | Caminho                         | Corpo                          | Resposta      |
| ------ | ------------------------------- | ------------------------------ | ------------- |
| GET    | `/turmas`                       | —                              | `Turma[]`     |
| POST   | `/turmas`                       | `{ id?, name, subject, term }` | `Turma`       |
| PATCH  | `/turmas/:id`                   | `{ name, subject, term }`      | `Turma`       |
| POST   | `/turmas/:id/arquivar`          | —                              | `Turma`       |
| POST   | `/turmas/:id/codigo-de-convite` | —                              | `Turma`       |
| GET    | `/matriculas`                   | —                              | `Matricula[]` |
| DELETE | `/matriculas/:id`               | —                              | `Matricula`   |
| POST   | `/matriculas/:id/restaurar`     | —                              | `Matricula`   |
| GET    | `/estudantes`                   | —                              | `Estudante[]` |

- O código de convite é gerado no servidor, que garante a unicidade; regenerar invalida
  o anterior no mesmo instante.
- O `id` da turma pode vir do cliente: a web cria a turma e navega ao detalhe sem
  esperar a resposta. Um `id` já existente responde `409`.
- `GET /matriculas` traz ativas e removidas; remover só muda a situação, as notas ficam.
- `GET /estudantes` traz só quem passou por alguma turma do professor (RNF05).

### Banco de questões (RF02)

| Método | Caminho                   | Corpo                                                                        | Resposta    |
| ------ | ------------------------- | ---------------------------------------------------------------------------- | ----------- |
| GET    | `/questoes`               | —                                                                            | `Questao[]` |
| GET    | `/questoes/:id`           | —                                                                            | `Questao`   |
| PUT    | `/questoes/:id`           | `{ type, statement, tags, alternatives?, correctAlternativeId?, maxScore? }` | `Questao`   |
| DELETE | `/questoes/:id`           | —                                                                            | `Questao`   |
| POST   | `/questoes/:id/restaurar` | —                                                                            | `Questao`   |

- `GET /questoes` traz o acervo ativo; `?incluirExcluidas=true` inclui as excluídas
  logicamente, que provas antigas ainda referenciam. `GET /questoes/:id` encontra
  também as excluídas.
- `PUT` cria ou atualiza pelo id e devolve a questão ao acervo ativo. Valida: enunciado
  obrigatório; objetiva com 2 a 5 alternativas com texto e ids distintos, e a correta
  entre elas; discursiva com pontuação máxima maior que zero e sem alternativas.

### Provas (RF04)

| Método | Caminho       | Corpo                                                 | Resposta              |
| ------ | ------------- | ----------------------------------------------------- | --------------------- |
| GET    | `/provas`     | —                                                     | `(Prova & blocos?)[]` |
| PUT    | `/provas/:id` | `{ title, description?, status, questions, blocos? }` | `Prova & blocos?`     |

- `PUT` cria ou atualiza pelo id, que nasce no navegador para o editor abrir sem esperar.
  Valida: título até 200 caracteres, no máximo 20 questões, pontuação não negativa.
- `questions` vira a tabela `questoes_da_prova`, mas só com questões que já existem no
  banco do professor (inclusive excluídas). A questão criada dentro da prova e ainda não
  salva no banco vive só em `blocos`; uma questão repetida conta uma vez.
- `blocos` é o layout do editor (texto, imagem, espaço, questões rascunho), protótipo da
  issue #12 guardado como chega, em coluna JSON. Por causa das imagens, o corpo JSON
  aceita até 5 MB.

## Ainda não coberto

- Autenticação, JWT e refresh token (RNF04): o professor é fixo em
  `src/professor-atual.ts`, ponto único a trocar.
- Aplicações, correções e relatórios: as tabelas já existem e o seed as preenche, mas
  não há endpoints. Exclusão de prova também não, porque a tela não oferece a ação.
- Sincronização da fila do aplicativo (RF08).
- Hospedagem da API (item 8 das pendências).
