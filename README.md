<div align="center">

# SGP Católica

### Da criação da prova à devolutiva da nota, em um único fluxo.

O professor prepara e aplica avaliações, corrige cartões-resposta pelo celular e
acompanha resultados. O estudante consulta suas notas com mais rapidez e clareza.

[![Status](https://img.shields.io/badge/status-em%20desenvolvimento-F5A623?style=flat-square)](#fase-atual)
[![Entrega](https://img.shields.io/badge/entrega-N1-3D348B?style=flat-square)](#fase-atual)
[![Vue](https://img.shields.io/badge/Vue-3-42B883?style=flat-square&logo=vuedotjs&logoColor=white)](apps/web)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](package.json)
[![React Native](https://img.shields.io/badge/React%20Native-mobile-61DAFB?style=flat-square&logo=react&logoColor=111111)](apps/mobile)
[![Expo](https://img.shields.io/badge/Expo-51-000020?style=flat-square&logo=expo&logoColor=white)](apps/mobile)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)](.nvmrc)
![Licença](https://img.shields.io/badge/licença-uso%20acadêmico-7B4FA6?style=flat-square)

[Visão do produto](docs/produto/visao-do-produto.md) ·
[Documentação](docs/README.md) ·
[Executar localmente](#executar-localmente) ·
[Contribuir](CONTRIBUTING.md)

</div>

---

## Avaliar não precisa significar corrigir tudo à mão

Em semanas de prova, um professor pode acumular centenas de avaliações para
corrigir. O SGP Católica nasce para reduzir esse trabalho: organiza turmas e
questões, gera provas com versões diferentes, identifica cada aplicação por QR Code
e transforma a correção em uma experiência rápida pelo celular.

Para o estudante, o mesmo fluxo encurta a espera pela nota e reúne o histórico de
desempenho em um único lugar.

## Uma experiência, três perspectivas

| Professor na web                                | Professor no aplicativo                                | Estudante na web                              |
| :---------------------------------------------- | :----------------------------------------------------- | :-------------------------------------------- |
| Organiza turmas, questões, provas e aplicações. | Lê o QR Code, confere respostas e registra a correção. | Entra em turmas e acompanha notas e evolução. |

O fluxo central conecta as três superfícies:

**criar a prova → gerar as versões → aplicar → corrigir → publicar o resultado**

## Fase atual

> **N1 — interfaces navegáveis.** A experiência está sendo construída com dados
> estáticos de [`packages/mocks`](packages/mocks), sem banco de dados, API,
> autenticação ou processamento real de câmera nesta etapa.

O conjunto final de telas da N1 ainda depende de validação da equipe e da professora.
As divergências e definições pendentes permanecem registradas em
[`docs/pendencias.md`](docs/pendencias.md), sem serem tratadas como decisões.

Quando o fluxo for aprovado, os registros visuais da entrega serão publicados em
[`docs/telas/`](docs/telas) e o mapa de navegação em [`docs/design/`](docs/design).

## Produto e requisitos

A especificação do produto está organizada fora deste README para que esta página
continue simples e orientada à visão geral:

- [Visão do produto](docs/produto/visao-do-produto.md) — problema, público e proposta de valor.
- [Requisitos funcionais](docs/produto/requisitos-funcionais.md) — RF01 a RF11 e critérios de aceite.
- [Requisitos não funcionais](docs/produto/requisitos-nao-funcionais.md) — desempenho, segurança, privacidade, operação offline e qualidade.
- [Dicionário de entidades](docs/modelo-dados/dicionario-de-entidades.md) — conceitos do domínio e correspondência com os tipos do código.

O recorte de requisitos por entrega ainda não foi aprovado. A especificação descreve
o produto completo; ela não deve ser confundida com o escopo técnico da N1.

## Fundação técnica

O projeto é um monorepo TypeScript com **Vue e Vite** na experiência web,
**React Native e Expo** no aplicativo do professor e pacotes compartilhados para
tipos, dados de demonstração e identidade visual.

```text
apps/       web · mobile · api
packages/   shared-types · mocks · design-tokens
docs/       produto · design · decisões · modelo de dados · API
```

Na N1, as aplicações consomem somente mocks. A API em `apps/api` (**NestJS** sobre
Express, com **MySQL** via Prisma) é a proposta da
[issue #66](https://github.com/Catolica-Tech-Academy-Hub/sgp-catolica/issues/66) para
resolver a divergência entre Node.js com Express e NestJS/Fastify. Ela já atende turmas
e banco de questões e vira decisão formal com o acordo da equipe. Como rodar e os
endpoints estão em [`docs/api/`](docs/api/README.md).

## Executar localmente

Use **Node.js 20 ou superior** e **npm 10 ou superior**.

```bash
git clone https://github.com/LeoAnders/sgp-catolica.git
cd sgp-catolica
npm ci
```

```bash
npm run web        # aplicação web em http://localhost:5173
npm run mobile     # aplicativo do professor com Expo
npm run api        # API em http://localhost:3000 (requer o MySQL, ver docs/api)
npm run typecheck  # valida todos os workspaces
npm run lint       # ESLint em web, mobile e api
npm run format     # aplica a formatação do Prettier
```

O sistema hospedado será disponibilizado durante a entrega da N1.

## Documentação

[`docs/README.md`](docs/README.md) é a porta de entrada para a documentação completa.
Lá estão os requisitos, o modelo do domínio, as pendências e, conforme o projeto
evoluir, os diagramas, decisões arquiteturais, telas, API e manual do usuário.

Para participar do desenvolvimento, consulte o
[`CONTRIBUTING.md`](CONTRIBUTING.md). O guia reúne o fluxo de Issues, branches,
commits, Pull Requests e revisão da equipe.

## Equipe

<table align="center">
  <tr>
    <td align="center" width="160">
      <img src="docs/assets/equipe/padrao.svg" width="88" alt="Avatar padrão"><br>
      <sub><strong>Cintia Wilbert<br>Lorenzetti</strong></sub>
    </td>
    <td align="center" width="160">
      <img src="docs/assets/equipe/padrao.svg" width="88" alt="Avatar padrão"><br>
      <sub><strong>Gabriel Massaia<br>de Oliveira</strong></sub>
    </td>
    <td align="center" width="160">
      <img src="docs/assets/equipe/padrao.svg" width="88" alt="Avatar padrão"><br>
      <sub><strong>Leonardo Matheus<br>Anders</strong></sub>
    </td>
    <td align="center" width="160">
      <img src="docs/assets/equipe/padrao.svg" width="88" alt="Avatar padrão"><br>
      <sub><strong>Rian Carlos<br>Odwazny Flexa</strong></sub>
    </td>
    <td align="center" width="160">
      <img src="docs/assets/equipe/padrao.svg" width="88" alt="Avatar padrão"><br>
      <sub><strong>Wesley Diorrani<br>Ferreira</strong></sub>
    </td>
  </tr>
</table>

<div align="center">

Projeto acadêmico da disciplina de Projeto e Arquitetura de Software.

</div>
