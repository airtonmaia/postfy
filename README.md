# Orquesia

Sistema operacional para agências de conteúdo: CRM comercial, gestão de
clientes, produção (Kanban e calendário editorial), aprovação com o cliente,
agendamento e relatórios.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| Banco e autenticação | Supabase (Postgres + Auth), com RLS |
| Funções de servidor | Vercel serverless (`api/`) |
| Arquivos | Cloudflare R2, por URL pré-assinada |
| E-mail | Resend |
| Analytics | PostHog |
| IA | Qualquer endpoint compatível com a API da OpenAI |

**Não há servidor de aplicação.** Autenticação e dados vão do navegador direto
para o Supabase, protegidos pela RLS. As funções em `api/` existem só para o
que precisa de segredo: a chave da IA, as credenciais do R2 e a do Resend.

## Começando

```bash
bun install
bun run dev      # http://localhost:5173
```

Sobe sem configuração: a URL e a chave publicável do Supabase têm um padrão
embutido. Crie sua agência pela tela **Nova Agência** no login.

| Comando | O que faz |
| --- | --- |
| `bun run dev` | Servidor de desenvolvimento |
| `bun run lint` | Typecheck (`tsc --noEmit`) |
| `bun run test` | Testes (Vitest) |
| `bun run build` | Build de produção em `dist/` |

## Autenticação

Supabase Auth. O JWT da sessão é exatamente o que a RLS enxerga como
`auth.uid()`: a mesma sessão que autentica é a que autoriza, então não existe
um segundo sistema de permissão no cliente para contornar.

- Cadastro cria a agência via RPC `criar_agencia`, de forma atômica
- Recuperação de senha por e-mail
- Convite de equipe por e-mail, com papel e validade de 7 dias

O convite vale para o e-mail convidado, não para quem tiver o link: o vínculo
só é criado depois que existe sessão com aquele mesmo endereço, e a RPC
`aceitar_convite` confere isso no banco.

### Papéis

Regras em `src/lib/permissions.ts` (o que a interface oferece) e nas políticas
de RLS (o que o banco permite). **A regra que vale é a do banco** — a interface
apenas evita oferecer o que a pessoa não pode fazer.

| Papel | Escreve em |
| --- | --- |
| `owner` | tudo, incluindo planos |
| `admin` | tudo da agência |
| `manager` | operação, clientes e comercial |
| `social_media`, `designer`, `copywriter` | conteúdo e clientes |
| `financial` | leads, propostas e contratos |
| `client` | nada (leitura via portal) |

Um designer não cria contrato: a política de RLS recusa com `42501`. Isso foi
testado impersonando usuários reais — ver `supabase/README.md`.

## Dados

Uma agência é um *workspace*; `workspace_members` liga `auth.users` a ele com
um papel, e é essa tabela que sustenta todo o isolamento.

As consultas do app **não filtram por `workspace_id`** de propósito: quem
recorta é a RLS. Filtrar no cliente daria a impressão de que a segurança mora
lá.

Cada alteração vira um `insert`, `update` ou `delete` da própria linha
(`src/lib/db.ts`), derivado de um diff do estado
(`src/lib/sincronizacao.ts`). Não há substituição de coleção inteira — era o
que fazia dois membros editando ao mesmo tempo sobrescreverem um ao outro.

O `localStorage` guarda só um cache de leitura, para a tela não nascer vazia.

Schema e verificações: **[`supabase/README.md`](./supabase/README.md)**.

## Funções serverless (`api/`)

| Rota | Para quê |
| --- | --- |
| `POST /api/gemini` | Geração de copy e conversão de feedback em checklist |
| `POST /api/upload-url` | URL pré-assinada do R2 (o binário não passa pela função) |
| `POST /api/send-invite` | E-mail de convite pelo Resend |
| `POST /api/webhook-test` | Disparo de teste, com proteção contra SSRF |

Todas exigem o token do Supabase no header `Authorization` e **revalidam a
permissão pelo banco** — nenhuma confia no que o navegador afirma. Cada uma
degrada com `503` e aviso claro quando o serviço não está configurado, em vez
de fingir que funcionou.

## IA

Dois pontos usam IA, ambos no modal de detalhe do conteúdo:

- **Gerar copy** — legenda, gancho, CTA, hashtags e roteiro de Reels, a partir
  do briefing do cliente
- **Gerar checklist do feedback** — transforma o texto solto do pedido de
  ajuste em tarefas separadas por designer e copywriter

Não há acoplamento a um fornecedor. A camada em `api/_lib/ia.ts` fala o
dialeto de chat completions da OpenAI, que OpenRouter, Gemini, Groq, Cerebras,
Mistral e modelos locais (Ollama, LM Studio) entendem. Trocar de fornecedor é
mudar `IA_PROVEDOR` e `IA_API_KEY` — sem release.

O padrão é o **OpenRouter**: uma chave só alcança dezenas de modelos, e os
terminados em `:free` não cobram. Quando um modelo gratuito sai do ar — e isso
acontece —, `IA_MODELO` aponta para outro sem tocar em código.

A extração do JSON tolera cerca de markdown e texto em volta da resposta,
porque modelos gratuitos costumam ser menos disciplinados no formato.

Sem chave configurada, os dois botões avisam que a IA não está disponível em
vez de fingir que geraram algo.

## Configuração

Tudo é opcional menos o Supabase, que já vem com padrão. Ver
[`.env.example`](./.env.example).

Regra que não se quebra: **o que começa com `VITE_` vai para o bundle e é
público.** A `service_role` do Supabase e as chaves de IA, R2 e Resend só
existem no ambiente das funções. O CI falha se alguma aparecer no bundle.

## O que ainda não existe

- **Cobrança.** As telas de planos e financeiro são catálogo e leitura: não há
  gateway, checkout, aplicação de limite de plano nem bloqueio por
  inadimplência.
- **Publicação automática nas redes.** Falta OAuth com Meta, LinkedIn e TikTok
  e uma fila de disparo. A tela de Publicações é cronograma; o post é manual.
- **Portal do cliente com link externo.** Hoje funciona como prévia interna
  para a equipe. O link para o cliente volta quando a resolução do token for
  feita numa função serverless.
- **Cofre de senhas sem criptografia.** Guarde ali só o que puder ficar em
  texto puro no banco.
- **Assinatura eletrônica de contrato.** O status é manual, sem validade
  jurídica nem trilha de auditoria.

## Testes

```bash
bun run test
```

Cobrem o que quebra em silêncio: mapeamento entre banco e app campo a campo,
diff de sincronização, permissões por papel, comparação de telefone do portal,
recorte por workspace e a proteção contra SSRF.

## Estrutura

```
api/            Funções serverless da Vercel
  _lib/         Autenticação das funções e proteção contra SSRF
src/
  components/   Telas por domínio
  context/      Estado central
  lib/          Supabase, dados, mapeadores, permissões, analytics
  types/        Tipos do domínio
supabase/
  migrations/   Schema versionado (fonte de verdade)
tests/          Vitest
```
