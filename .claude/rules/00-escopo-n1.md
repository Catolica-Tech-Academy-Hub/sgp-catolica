# Escopo da fase N1

## Vale

- Telas navegaveis na web e no aplicativo do professor.
- Componentes de interface e tokens de design compartilhados.
- Dados estaticos vindos de `packages/mocks`.
- Fluxos de navegacao completos o suficiente para demonstrar o produto ao cliente.

## Nao vale nesta fase

- Banco de dados, ORM ou migracoes.
- Backend, API real, autenticacao real ou emissao de tokens.
- Leitura real de camera, QR Code ou processamento de imagem.
- Sincronizacao offline real (a fila local pode ser representada com dados estaticos).
- Kubernetes, Rancher, K3s ou qualquer orquestracao de containers.

Quando uma tela precisar de um comportamento que pertence a uma fase futura,
represente o estado com dado estatico e deixe o ponto de integracao explicito no
codigo, sem criar a implementacao real.

Excecao em andamento: a issue #66 introduz a API em `apps/api` (NestJS, MySQL,
Prisma) e o `docker-compose.yml` do MySQL de desenvolvimento. Ela cobre turmas,
matriculas, estudantes e banco de questoes, e a issue #71 acrescenta provas; o resto
da lista acima continua valendo ate ter issue propria.

A web usa Vite + Vue, conforme a especificacao v1.10 e o alinhamento confirmado em
2026-08-17. A migracao do scaffold foi concluida; nao reintroduza React na web.
