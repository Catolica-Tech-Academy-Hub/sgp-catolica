# Prints das telas

Capturas de tela da aplicação, referenciadas pelo `README.md` da raiz para a
demonstração da N1 (a metodologia da disciplina espera esse registro visual).

## Como capturar

Usar o MCP `playwright` (configurado em `.mcp.json` na raiz do repositório): navegar
até a rota da tela com o app rodando localmente (`npm run web`) e tirar o print pelo
próprio MCP, em vez de captura manual de tela — mantém o processo repetível a cada
issue que adiciona ou muda uma tela.

## Convenção de nome

O nome do arquivo é a rota, não uma ordem de navegação — assim ele fica estável: uma
tela sempre tem o mesmo nome de print, atualizar é sobrescrever o arquivo existente,
nunca criar um novo. Isso é o que permite a quem (ou à IA) for atualizar uma tela
reconhecer que já existe um print dela em vez de duplicar.

- Web: a rota sem a barra inicial, `/` interna virando `-`. `:id` dinâmico ganha um
  sufixo descritivo do que a tela mostra, não o literal `:id`.
  Ex.: `/login` → `login.png`; `/provas` → `provas.png`; `/provas/:id` (editor) →
  `provas-editor.png`; `/turmas/:id` → `turmas-detalhe.png`.
- Mobile: prefixo `mobile-` + nome da tela no fluxo de navegação (não há URL).
  Ex.: `mobile-login.png`, `mobile-lista-aplicacoes.png`,
  `mobile-conferencia-objetiva.png`.
- Perspectiva do estudante: prefixo `estudante-`, mesma lógica.
  Ex.: `estudante-login.png`, `estudante-historico.png`.

Uma rota pode ter mais de um print quando o requisito da tela vive num estado sobreposto
(um `Dialog`, por exemplo) que o print da lista não mostra. Nesse caso o arquivo extra
usa a rota mais um sufixo do que ele demonstra — `correcoes-atribuir.png` para o diálogo
de atribuição manual de `/correcoes` — e entra na tabela como uma linha própria.

Antes de capturar um print novo, checar se já existe um arquivo com esse nome em
`docs/telas/` — se existir, o print desta entrega **substitui** o anterior (mesmo
nome, mesmo lugar no `docs/README.md`), não entra como arquivo adicional.

## Quando adicionar

Toda issue que implementa ou altera visualmente uma tela inclui, no critério de
conclusão, o print correspondente aqui (novo ou atualizado) — ver
[`.claude/rules/45-padrao-de-issue.md`](../../.claude/rules/45-padrao-de-issue.md).

## Capturas atuais

| Tela                     | Rota          | Print                                            |
| ------------------------ | ------------- | ------------------------------------------------ |
| Lista de aplicações      | `/aplicacoes` | [aplicacoes.png](aplicacoes.png)                 |
| Listagem de turmas       | `/turmas`     | [turmas.png](turmas.png)                         |
| Detalhe da turma         | `/turmas/:id` | [turmas-detalhe.png](turmas-detalhe.png)         |
| Fila de correções        | `/correcoes`  | [correcoes.png](correcoes.png)                   |
| Correções: atribuir nota | `/correcoes`  | [correcoes-atribuir.png](correcoes-atribuir.png) |
