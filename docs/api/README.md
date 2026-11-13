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

### Logs (RNF07)

A API escreve uma linha JSON por evento na saída do processo, que o Render guarda na aba
**Logs** do serviço (`src/observabilidade/`). Cada requisição gera uma linha quando a
resposta termina:

```json
{
  "momento": "2026-11-13T23:55:09.988Z",
  "nivel": "log",
  "tipo": "requisicao",
  "requisicaoId": "65677040-9977-4d8d-b5b1-4b648046ed52",
  "metodo": "GET",
  "rota": "/questoes/:id",
  "status": 200,
  "duracaoMs": 13.2
}
```

- `rota` é o padrão da rota (`/questoes/:id`), não o caminho com os ids, para as linhas
  da mesma rota poderem ser agrupadas.
- `requisicaoId` vem do cabeçalho `X-Request-Id` quando o cliente manda um válido, ou é
  gerado; volta na resposta no mesmo cabeçalho. Com ele, um erro visto na tela é achado
  no log pela busca do Render.
- Status 500 sai com `"nivel":"error"`, e o erro que o causou aparece numa linha
  própria, com a pilha. Conexão fechada antes da resposta é registrada com status 499.
- Corpo, query string e cabeçalhos **não** vão para o log: o corpo da matrícula leva o
  e-mail do estudante, e depois da autenticação os cabeçalhos levam o token (RNF05).

### Monitor de disponibilidade (RNF03)

`GET /saude` consulta o banco: responde `200` com `{"status":"ok","banco":"ok"}` e `500`
quando o MySQL não responde. É o endereço que o monitor deve vigiar.

Monitor escolhido: **UptimeRobot**, plano Free (50 monitores, intervalo mínimo de 5
minutos; <https://uptimerobot.com/pricing/>). A configuração é feita no painel do
UptimeRobot, com uma conta da equipe:

1. **Add New Monitor** → tipo **HTTP(s)**, URL `<URL da API>/saude`, intervalo de 5
   minutos.
2. Em **Alert Contacts**, cadastrar o e-mail de cada integrante e marcá-los no monitor.
   A página de preços não deixa claro quais canais de alerta entram no plano Free;
   confirmar que o e-mail aparece disponível ao criar o contato.
3. Opcional: uma página de status pública (o plano Free inclui uma).

O ping a cada 5 minutos também impede o Render de hibernar a API, já que ela só hiberna
depois de 15 minutos sem tráfego. O custo é de horas: o Render dá **750 horas de
instância gratuita por mês por workspace** e, quando elas acabam, **suspende todos os
Web Services gratuitos do workspace até o mês seguinte**
(<https://render.com/docs/free>). Uma API acordada o mês inteiro usa até 744 horas,
então isso só cabe se ela for o único Web Service gratuito do workspace. Static Sites,
como a web, não são Web Services. Se a conta tiver outro Web Service gratuito, use um
intervalo maior que 15 minutos, que mantém o alerta e deixa a API hibernar.

### Backup do banco (RNF08)

O que a documentação do Aiven garante (<https://aiven.io/docs/platform/concepts/service_backups>):

- todo serviço, exceto Kafka, tem **backup automático e criptografado**;
- os backups **não podem ser baixados**; para ter uma cópia própria, a documentação
  indica `mysqldump`;
- ao religar um serviço desligado, o último backup é restaurado automaticamente.

O que ela **não** diz: a frequência e por quantos dias os backups são guardados. Além
disso, a página atual de planos (<https://aiven.io/docs/platform/concepts/free-plan>)
lista o plano Free só para PostgreSQL, Kafka, OpenSearch e Valkey; para MySQL, cita o
Developer tier. Como a seção acima registra "plano Free", falta conferir no console do
Aiven, com a conta da equipe:

1. qual é o plano do serviço MySQL e se ele está num período de teste com créditos (sem
   cartão, serviços são desligados quando o teste ou os créditos acabam);
2. na aba **Backups** do serviço, as datas dos backups existentes, que mostram a
   frequência e quantos dias ficam guardados.

Enquanto a retenção de 30 dias de RNF08 não estiver confirmada, a equipe mantém um dump
manual. Ele roda de uma máquina com Docker, sem instalar o MySQL, e usa o mesmo
certificado da API:

```bash
# Na raiz do repositório. ca.pem baixado do console do Aiven; dados da URL do serviço.
mkdir -p backups
docker run --rm -e MYSQL_PWD='<senha>' -v "$PWD/backups:/backups" \
  -v "$PWD/backups/ca.pem:/ca.pem:ro" mysql:8.4 \
  sh -c 'mysqldump --ssl-mode=VERIFY_CA --ssl-ca=/ca.pem -h <host> -P <porta> -u <usuario> \
    --single-transaction --no-tablespaces --set-gtid-purged=OFF <banco> \
    > /backups/sgp-$(date +%F).sql'
```

No Git Bash do Windows, comece o comando com `MSYS_NO_PATHCONV=1`; sem isso, o caminho
`/backups` do container é convertido para um caminho do Windows.

Para conferir ou restaurar um dump, use um banco separado: o arquivo apaga e recria as
tabelas que contém. No MySQL local, do `docker-compose.yml`:

```bash
docker compose exec -T mysql mysql -usgp -psgp -e "CREATE DATABASE IF NOT EXISTS sgp_restaurado"
docker compose exec -T mysql mysql -usgp -psgp sgp_restaurado < backups/sgp-AAAA-MM-DD.sql
```

A pasta `backups/` está no `.gitignore`: um dump tem dados de estudantes e nunca entra
no repositório (RNF05). Guarde os arquivos num lugar privado da equipe e apague os com
mais de 30 dias.

### Limites da hospedagem gratuita

Os planos gratuitos não permitem cumprir RNF03 e RNF08 como estão escritos. Trocar de
plano está fora do escopo da N3 (issue #104).

| Requisito                   | Limite                                                                                                                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RNF03 (99,5% de uptime/mês) | A API hiberna depois de 15 minutos sem tráfego e leva cerca de um minuto para acordar (em 13/11/2026, a primeira resposta levou 34 s); o Render pode reiniciar instâncias gratuitas a qualquer momento; o MySQL roda em um único nó. Nenhum dos dois serviços gratuitos promete disponibilidade. |
| RNF03                       | Se as 750 horas mensais do workspace acabarem, o Render suspende a API até o mês seguinte.                                                                                                                                                                                                       |
| RNF08 (backup diário, 30 d) | O Aiven faz backup automático, mas não documenta frequência nem retenção, e os backups não podem ser baixados. Até a conferência no console, a retenção de 30 dias depende do dump manual.                                                                                                       |
| RNF07 (métricas e alertas)  | Há logs estruturados e alerta de indisponibilidade; não há coleta de métricas (latência por rota ao longo do tempo); a duração de cada requisição só fica nos logs.                                                                                                                              |

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
