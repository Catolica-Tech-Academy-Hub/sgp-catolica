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
`localStorage`).

| Script (`--workspace @sgp/api`) | O que faz                                                  |
| ------------------------------- | ---------------------------------------------------------- |
| `dev`                           | API com recarga automática (`npm run api` na raiz)         |
| `build` / `start`               | Compila para `dist/` e roda a versão compilada             |
| `db:migrate`                    | Cria uma migração nova a partir de mudanças no esquema     |
| `db:deploy`                     | Aplica as migrações pendentes                              |
| `db:seed`                       | Apaga os dados e repopula com `@sgp/mocks`                 |
| `db:reset`                      | Apaga o banco inteiro, reaplica as migrações e roda o seed |

## Produção

Na N2 o sistema roda em serviços gratuitos (issue #70):

```text
navegador → web (Render, site estático) → API (Render, web service) → MySQL (Aiven)
```

**MySQL (Aiven, plano Free).** A URL do serviço traz `ssl-mode=REQUIRED`. Com ela, a API
e o Prisma exigem `DATABASE_CA_CERT` com o conteúdo do `ca.pem` do serviço e conferem o
certificado do servidor contra ele (`src/prisma/adaptador.ts` e `prisma.config.ts`).
Migração e seed rodam de uma máquina da equipe, apontando para o banco hospedado:

```bash
# DATABASE_URL e DATABASE_CA_CERT do Aiven no ambiente (nunca no repositório)
npm run db:deploy --workspace @sgp/api
npm run db:seed --workspace @sgp/api      # só na primeira vez: apaga e repopula
```

**API (Render, Web Service gratuito).** Repositório na raiz, branch `main`.

| Campo         | Valor                                                                             |
| ------------- | --------------------------------------------------------------------------------- |
| Build Command | `npm ci && npm run build --workspace @sgp/api`                                    |
| Start Command | `npm run start --workspace @sgp/api`                                              |
| Variáveis     | `NODE_VERSION=22`, `DATABASE_URL`, `DATABASE_CA_CERT`, `CORS_ORIGIN` (URL da web) |

A instância gratuita hiberna depois de 15 minutos sem uso; a primeira requisição depois
disso leva cerca de um minuto. Antes de uma demonstração, abra `/saude` para acordá-la.

**Web (Render, Static Site).**

| Campo             | Valor                                             |
| ----------------- | ------------------------------------------------- |
| Build Command     | `npm ci && npm run build --workspace @sgp/web`    |
| Publish Directory | `apps/web/dist`                                   |
| Variáveis         | `NODE_VERSION=22`, `VITE_API_URL` (URL da API)    |
| Rewrite           | `/*` → `/index.html`, para o F5 em rotas internas |

Os dois serviços publicam de novo a cada push na `main`. Segredos ficam só nas
variáveis dos serviços.

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

| Método | Caminho                | Corpo                                                 | Resposta              |
| ------ | ---------------------- | ----------------------------------------------------- | --------------------- |
| GET    | `/provas`              | —                                                     | `(Prova & blocos?)[]` |
| PUT    | `/provas/:id`          | `{ title, description?, status, questions, blocos? }` | `Prova & blocos?`     |
| POST   | `/provas/:id/encerrar` | —                                                     | `Prova & blocos?`     |

- `PUT` cria ou atualiza pelo id, que nasce no navegador para o editor abrir sem esperar.
  Valida: título até 200 caracteres, no máximo 20 questões, pontuação não negativa.
  Provas novas sempre começam como `draft`; atualizações de conteúdo não alteram a
  situação, que é controlada pelo servidor.
- `questions` vira a tabela `questoes_da_prova`, mas só com questões que já existem no
  banco do professor (inclusive excluídas). A questão criada dentro da prova e ainda não
  salva no banco vive só em `blocos`; uma questão repetida conta uma vez.
- `blocos` é o layout do editor (texto, imagem, espaço, questões rascunho), protótipo da
  issue #12 guardado como chega, em coluna JSON. Por causa das imagens, o corpo JSON
  aceita até 5 MB.
- A primeira aplicação move `draft` para `ready` na mesma transação que a cria. Provas
  `closed` recusam aplicações novas com `409`; `POST /provas/:id/encerrar` arquiva a
  prova sem removê-la do acervo e pode ser repetido com segurança.

### Aplicações (RF05)

| Método | Caminho           | Corpo                 | Resposta      |
| ------ | ----------------- | --------------------- | ------------- |
| GET    | `/aplicacoes`     | —                     | `Aplicacao[]` |
| GET    | `/aplicacoes/:id` | —                     | `Aplicacao`   |
| POST   | `/aplicacoes`     | `{ examId, classId }` | `Aplicacao`   |

- Os três endpoints atuam apenas sobre aplicações do professor atual. Aplicação ou
  referência a prova/turma de outro professor responde `404`.
- `POST` aceita reaplicações da mesma prova à mesma turma; cada chamada cria uma
  aplicação independente em `draft`. A criação e a transição da prova para `ready`
  acontecem na mesma transação.
- Provas `closed` recusam a criação com `409`. A geração de versões e PDF fica nos
  endpoints RF06 abaixo.

### Geração de versões e PDF (RF06)

| Método | Caminho                       | Corpo                                                                            | Resposta                                                       |
| ------ | ----------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| POST   | `/aplicacoes/:id/gerar`       | `{ quantity, shuffleQuestions, shuffleAlternatives, withStudentIdentification }` | `{ versions: VersaoProva[], assignments: AtribuicaoVersao[] }` |
| POST   | `/aplicacoes/:id/gerar-pdf`   | Opções acima + `cabecalho?`                                                       | `{ application, versions, assignments }`                       |
| GET    | `/aplicacoes/:id/pdf`         | —                                                                                | `application/pdf` (download)                                   |

- `quantity` aceita de 1 a 20 versões. Cada versão embaralha questões e alternativas
  independentemente quando a respectiva opção está ativa.
- O layout sempre materializa a ordem impressa das questões e das alternativas. Quando
  uma opção de embaralhamento está desativada, grava a ordem original da prova/questão.
- Com identificação, cada estudante com matrícula ativa recebe uma atribuição para uma
  versão; os estudantes são distribuídos aleatória e balanceadamente entre as versões.
  Sem identificação, não são criadas atribuições.
- Payloads de QR seguem `sgp:v1:version:<versionId>` para uma versão anônima ou
  `sgp:v1:version:<versionId>:student:<studentId>` para uma atribuição identificada.
  São distintos de `publicCode`.
- Regenerar substitui versões e atribuições anteriores. Se já houver correção confirmada,
  responde `409`.
- `POST /gerar` prepara somente versões e atribuições. Se substituir uma geração anterior
  sem correções, volta a aplicação para `draft` e limpa o PDF associado.
- `POST /gerar-pdf` materializa as versões e atribuições, renderiza um único PDF consolidado
  e grava os bytes em `aplicacoes.pdfContent` (`LONGBLOB`) na mesma transação. Só depois de
  renderizar com sucesso a aplicação passa a `generated`; uma falha não publica PDF parcial.
  Uma regeneração bem-sucedida sobrescreve o arquivo anterior.
- Com identificação, cada matrícula ativa recebe uma cópia com nome e QR único; sem
  identificação, é gerada uma cópia por versão com QR que identifica apenas a versão. O QR
  aparece na primeira folha da prova e no cartão-resposta para que a folha lida mantenha a
  identificação da cópia.
- Blocos de prova são mantidos inteiros entre páginas. Um bloco que excede a área útil A4
  interrompe a geração com `400`. Questões de rascunho não salvas no banco também impedem a
  geração; imagens aceitas no PDF são PNG e JPEG.
- O cartão-resposta segue o layout provisório de leitura mobile: folha A4 separada, quatro
  marcadores de canto e até 20 questões objetivas, com 2 a 5 alternativas. A validação
  física com folhas impressas e fotos reais continua pendente; não usar como garantia de
  leitura operacional antes dessa verificação.

Os testes de regras da API podem ser executados com `npm run test --workspace @sgp/api`.

## Ainda não coberto

- Autenticação, JWT e refresh token (RNF04): o professor é fixo em
  `src/professor-atual.ts`, ponto único a trocar.
- Demais operações de aplicações, correções e relatórios. Exclusão de prova também não,
  porque a tela não oferece a ação.
- Sincronização da fila do aplicativo (RF08).
