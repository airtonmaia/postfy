# Orquesia

Sistema operacional para agências de conteúdo: CRM comercial, gestão de clientes,
produção (Kanban e calendário editorial), aprovação com o cliente, agendamento e
relatórios.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Servidor**: Express (mesma porta serve a API e o frontend)
- **Persistência**: store em arquivo JSON no servidor (ver *Dados*)
- **IA**: Google Gemini (opcional)

## Começando

```bash
bun install          # ou npm install
cp .env.example .env # preencha SESSION_SECRET
bun run dev          # http://localhost:3000
```

Na primeira vez, crie sua agência pela tela **Nova Agência** no login. Para um
deploy novo já subir com um usuário, defina `ADMIN_EMAIL` e `ADMIN_PASSWORD` no
ambiente: o proprietário é criado no boot.

### Scripts

| Comando | O que faz |
| --- | --- |
| `bun run dev` | Servidor de desenvolvimento com Vite em middleware |
| `bun run lint` | Typecheck (`tsc --noEmit`) |
| `bun run test` | Testes com Vitest |
| `bun run build` | Build do frontend + bundle do servidor em `dist/` |
| `bun run start` | Roda o build de produção |

## Autenticação

A sessão vive no servidor: cookie `httpOnly` assinado com HMAC-SHA256, senhas
com hash **scrypt** e salt por usuário. O cookie não é acessível ao JavaScript,
então um XSS não consegue roubar a sessão.

- `POST /api/auth/register` — cria uma agência e seu proprietário
- `POST /api/auth/login` / `POST /api/auth/logout`
- `GET  /api/auth/me` — restaura a sessão ao abrir o app

Login e cadastro têm rate limit por IP e por e-mail alvo.

### Convites de equipe

Quem tem papel `owner` ou `admin` gera um link de convite em
**Configurações → Usuários**. A pessoa convidada abre o link, define a própria
senha e entra já na agência certa, com o papel definido no convite. Os convites
valem 7 dias e podem ser revogados.

Não há envio de e-mail: o link é compartilhado pelo canal que a agência preferir.

### Papéis e permissões

As regras ficam em `src/lib/permissions.ts` e governam quais telas cada papel vê
e quais ações pode executar.

| Papel | Alcance |
| --- | --- |
| `owner` | Tudo, incluindo a administração do SaaS |
| `admin` | Tudo na agência |
| `manager` | Operação, clientes e comercial |
| `social_media` | Produção, calendário, aprovações e publicações |
| `designer` / `copywriter` | Produção e aprovações |
| `financial` | Clientes, comercial e relatórios |
| `client` | Somente aprovações |

> As permissões do frontend evitam oferecer o que a pessoa não pode fazer.
> Regras que protegem dados precisam existir **também** no servidor. Hoje o
> servidor impõe o recorte por workspace em todas as rotas de dados e o papel
> nas rotas de convite.

## Dados

Cada agência é um *workspace*. O recorte por workspace é imposto no servidor:
as linhas recebidas são carimbadas com o workspace da sessão, então o cliente
não escolhe em qual agência escreve.

- `GET /api/data` — todas as coleções do workspace da sessão
- `PUT /api/data/:colecao` — substitui as linhas daquela coleção no workspace

O navegador mantém uma cópia local (`localStorage`) para abrir rápido e
continuar funcionando se o servidor cair; a fonte de verdade é o servidor.

### Onde os dados ficam

O store grava JSON em `DATA_DIR` (padrão `./data`), com escrita atômica.
É um processo único por design.

**Para rodar com mais de uma instância**, troque `server/lib/store.ts` por
Postgres mantendo a mesma interface. O schema já está pronto em
`supabase/schema.sql`, com políticas de RLS que recortam por workspace através
da tabela `workspace_members`.

## Portal do cliente

O link externo carrega o `portalToken` opaco do cliente
(`?portal=<token>`), gerado por `buildClientPortalUrl`. O cliente aprova,
pede ajustes e envia materiais sem ter conta na plataforma.

## IA

Sem `GEMINI_API_KEY`, as rotas de IA respondem `503` e a interface avisa que o
recurso não está configurado — elas não devolvem texto de exemplo. As rotas
exigem sessão e têm rate limit, para que a chave não seja consumida por
terceiros.

## O que ainda não existe

Vale ser explícito para ninguém contar com o que não está pronto:

- **Publicação automática nas redes.** Não há OAuth com Meta, LinkedIn, TikTok
  ou YouTube, nem fila de disparo. A tela de Publicações é um cronograma; o post
  é feito manualmente.
- **Cobrança.** As telas de planos e financeiro do SaaS são de leitura: não há
  gateway de pagamento, checkout, aplicação de limites de plano nem bloqueio por
  inadimplência.
- **Envio de e-mail.** Convites saem por link; não há recuperação de senha.
- **Anexos na nuvem.** Arquivos anexados viram data URL e ficam no navegador,
  com limite de 1,5 MB cada. Para mídias pesadas, use URL.
- **Cofre de senhas de cliente sem criptografia.** Guarde ali apenas o que puder
  ficar em texto puro até que a criptografia seja implementada.
- **Assinatura eletrônica de contrato.** O status é manual, sem validade
  jurídica nem trilha de auditoria.

## Deploy

```bash
bun run build
NODE_ENV=production bun run start
```

Requisitos do ambiente:

- `SESSION_SECRET` definido (senão as sessões caem a cada redeploy)
- `DATA_DIR` apontando para um volume persistente
- `PORT` — respeitado automaticamente quando a plataforma injeta

O servidor define `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy` e, em produção, `Strict-Transport-Security`.
`trust proxy` está ligado para o rate limit enxergar o IP real atrás do proxy.

## Testes

```bash
bun run test
```

Cobrem o que quebra em silêncio: hash e verificação de senha, assinatura e
adulteração de sessão, permissões por papel, comparação de telefone do portal e
o recorte por workspace (incluindo a regressão que apagava dados de outras
agências).

## Estrutura

```
server/            API Express
  lib/             crypto, store em arquivo, auth, helpers HTTP
  routes/          auth (+ convites), data, gemini
src/
  components/      telas por domínio
  context/         estado central da aplicação
  lib/             cliente da API, armazenamento, permissões, escopo, telefone
  types/           tipos do domínio
supabase/          schema com RLS para a migração para Postgres
tests/             Vitest
```
