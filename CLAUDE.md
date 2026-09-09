# Orquesia

SaaS de gestão para agências de conteúdo. React 19 + TypeScript + Vite, dados
no Supabase, funções serverless na Vercel.

Este arquivo registra as decisões e as armadilhas que já custaram caro. Cada
item aqui existe porque um bug real passou por ele.

---

## Como rodar

```bash
bun install          # o lockfile é bun.lock; npm install também funciona
bun run dev          # http://localhost:5173 — só o front
bun run lint         # tsc --noEmit
bun run test         # vitest
bun run build
```

**As rotas `/api` não sobem com o Vite.** São funções serverless; o Vite serve
só o front, então upload, IA e e-mail falham com erro de rede em
`bun run dev`. Para testá-las:

```bash
vercel dev           # sobe front e /api juntos, lendo .env
```

A URL e a chave publicável do Supabase têm padrão embutido em
`src/lib/supabase.ts`, apontando para o projeto de produção. O app sobe sem
`.env` — e isso significa que **o banco local é o de produção**. Cliente
criado em desenvolvimento aparece no app publicado.

---

## Arquitetura

O navegador fala **direto** com o Supabase. Não há servidor de aplicação.

```
navegador ──► Supabase (Postgres + Auth)   ← RLS recorta por agência
    │
    └──────► /api/*  ← só o que precisa de segredo
```

Em `/api` fica exclusivamente o que não pode ir para o bundle: chave da IA,
credenciais do R2, chave do Resend, segredo do OAuth. Toda rota valida o JWT
do Supabase e **reconfere a permissão no banco** — nenhuma confia no que o
navegador afirma.

**As consultas não filtram por `workspace_id` de propósito.** Quem recorta é a
RLS. Filtrar no cliente daria a impressão de que a segurança mora lá.

### Persistência derivada de diff

`src/context/PostfyContext.tsx` tem dezenas de mutações no formato
`setAllX(prev => ...)`. Em vez de reescrever cada uma para chamar o banco,
`useColecaoSincronizada` compara o estado anterior com o novo e deriva os
inserts, updates e deletes.

Consequência: **qualquer mutação nova é persistida sem precisar lembrar de
nada** — e qualquer erro na camada de diff some com o dado em silêncio, porque
a tela já mostrou o resultado antes de o banco responder.

---

## Armadilhas

Nove regras. Todas vieram de bugs que chegaram a produção.

### 0. Import relativo em `api/` precisa da extensão `.js`

```ts
import { json } from './_lib/auth.js';   // ✅
// import { json } from './_lib/auth';   // ❌ derruba a função inteira
```

O `package.json` tem `"type": "module"`, então o Node carrega as funções como
ESM — e **em ESM a extensão é obrigatória no import relativo**. Sem ela o
módulo nem carrega: `ERR_MODULE_NOT_FOUND`, a função morre antes da primeira
linha, e a Vercel devolve `FUNCTION_INVOCATION_FAILED` — 500 sem corpo, sem
stack.

Foi isto que derrubou **todas** as rotas `/api` desde o primeiro dia, e custou
quatro rodadas de diagnóstico. O que torna a armadilha cara é que nenhuma
ferramenta local reclama: o TypeScript resolve `./x.js` para `./x.ts`, o
vitest usa a resolução do Vite, e o `vite build` nem olha para `api/`. Tudo
verde, produção morta.

O TypeScript aceita a extensão `.js` apontando para um arquivo `.ts` — é a
convenção do NodeNext e funciona nos dois lados.

Protegido por `tests/rotas-api.test.ts`.

### 1. Rota `/api` exporta um handler `(req, res)` pelo adaptador

```ts
async function handler(request: Request): Promise<Response> { ... }
export const POST = handler;      // para os testes chamarem direto
export default rota(handler);     // ✅ o que a Vercel executa
```

Escrevemos as rotas com `Request`/`Response`, que é o formato bom de testar.
Mas **a Vercel decide a assinatura inspecionando o formato do export, e essa
regra muda entre versões do builder** — e a versão que roda na nuvem não é a
do `package.json`, então não dá para fixá-la.

Isso quebrou duas vezes, com o mesmo sintoma:

1. `export default` com assinatura Web → tratado como handler do Node, chamado
   com `(req, res)`; `request.headers.get(...)` estoura num `IncomingMessage`
   e a função morre antes de responder.
2. `export const POST` sem default → reconhecido pelos builders novos,
   ignorado pelos antigos, que procuram só o default. Sem handler, crash de
   novo.

O adaptador em `api/_lib/rota.ts` sai desse jogo: exporta o formato que
**toda** versão entende e converte para Web por dentro. A detecção deixa de
importar.

O sintoma, das duas vezes: `FUNCTION_INVOCATION_FAILED` na URL, e
`"Falha na requisição (500)"` no app — que só aparece quando a resposta não é
JSON. Todos os nossos erros são JSON, então esse texto significa **crash**,
não erro tratado.

O adaptador também precisa ler o corpo de `req.body`, e não do stream: a
Vercel entrega handlers `(req, res)` com o corpo **já consumido e parseado**.
Montar o Request a partir do stream esgotado produz um corpo que nunca
termina — `request.json()` espera para sempre, a função não responde, não
estoura e não gera log. O sintoma é a requisição pendurada: foi assim que o
upload ficou parado em 0%, e as rotas GET esconderam o problema porque não
têm corpo para ler.

Protegido por `tests/rotas-api.test.ts`, que chama o default como a Vercel
chama — inclusive com corpo já parseado — e exige que ele escreva uma
resposta.

### 2. Id gerado no cliente tem que ser uuid

```ts
import { novoId } from './lib/sincronizacao';
id: novoId(),              // ✅
// id: `job-${Date.now()}`  // ❌ o Postgres recusa a linha inteira
```

Toda tabela usa `id uuid primary key`. Um id fora desse formato faz o insert
falhar com `invalid input syntax for type uuid` — e como a persistência roda
em segundo plano, **a tela segue mostrando o item que nunca foi salvo**.

`criarRepositorio.criar` manda o `id` junto no insert. Sem isso o Postgres
gera outro, a tela guarda o antigo, e a cada recarga o app não reconhece as
linhas e insere tudo de novo: um cliente virou 76 assim.

Protegido por `tests/ids.test.ts`, que varre o `src` atrás do padrão antigo.

### 3. Gravação entre tabelas segue a ordem de dependência

Uma ação pode tocar duas coleções ligadas por chave estrangeira — converter
lead em cliente cria o cliente e o contrato no mesmo render. As gravações
passam por uma fila única (`filaDeGravacao`), na ordem em que os hooks
`useColecaoSincronizada` são declarados.

**Reordenar esses hooks quebra isso sem nenhum sintoma imediato**: o filho é
gravado antes do pai, o Postgres recusa com `23503` e ninguém repete.

Protegido por `tests/ordem-de-gravacao.test.ts`.

### 4. Nada de dado da aplicação no navegador

Sem `localStorage` para dado de agência. Ele existia como cache e cobrou caro:
um cliente com logo em base64 ocupou 4,8 MB e estourou a cota. Pior que o
aviso era o efeito silencioso — parte do estado ficava só ali, e o que a tela
mostrava dependia de qual máquina abriu.

Preferências (tema, última agência) ficam em `user_settings`, com RLS por
linha. A sessão do Supabase Auth continua no `localStorage`: é o que mantém o
login entre reloads, e não é dado de agência.

Protegido pelo teste de guarda em `tests/ids.test.ts`, com essa exceção
escrita.

### 5. Arquivo vai para o R2, nunca para dentro do registro — e o bucket precisa de CORS

Sem `readAsDataURL`. Use `arquivosApi.enviar`, que pede URL pré-assinada e
manda o binário do navegador direto para o R2.

Sem armazenamento configurado, **não caia de volta no base64** — era ele o
problema. A tela oferece colar a URL.

O bucket precisa de **política de CORS**, e isso não é opcional: o PUT parte
do navegador, então sem a origem liberada ele é bloqueado antes de sair e a
barra trava em 0% — sem erro no console da função, porque a função nem é
chamada. O bucket `orquesia-midia` estava sem nenhuma regra, e foi essa a
causa da primeira falha de upload em produção. Ver `.env.example`.

### 6. `vercel.json` não é validado pelo CI

O CI roda `tsc`, testes e `vite build`. **Nenhum deles olha o `vercel.json`**,
que só é validado no deploy de verdade.

Já passou um cron de 5 minutos com o CI verde: contas Hobby da Vercel só
aceitam cron diário, e isso derruba o deploy inteiro. Por isso o agendamento
da fila de publicação vive em `.github/workflows/publicar.yml`, e não no
`vercel.json`.

O `rewrite` para `/index.html` também mora ali, e é **ele** que faz o F5
funcionar fora da raiz: agora que cada menu tem URL própria, sem o rewrite
recarregar em `/calendario` devolve 404 da Vercel antes de o app existir. O
padrão exclui `/api/` de propósito — engolir esse prefixo faria toda função
serverless devolver HTML.

`tests/rotas.test.ts` lê o `vercel.json` e confere as duas coisas. É a única
guarda que existe para esse arquivo.

Mudança nesse arquivo merece desconfiança dobrada — CI verde ali não
significa nada.

### 7. Helper de RLS no schema `private` mantém o EXECUTE padrão

```sql
create function private.eh_admin_da_plataforma() ... security definer;
grant execute on function private.eh_admin_da_plataforma() to public;  -- ✅
-- revoke all on function ... from authenticated;                       -- ❌
```

A policy resolve a função pelo OID, mas o privilégio de execução é conferido
**em tempo de execução, como o usuário da sessão**. Revogar o `EXECUTE` faz
toda leitura da tabela protegida falhar com `42501`.

Quem impede a chamada direta é o schema `private` não conceder `USAGE` — e o
PostgREST só expõe `public`.

---

### 8. Quem chega por convite já tem agência

`garantirAgencia()` cria a agência de quem não tem nenhuma. No fluxo de
convite isso é errado: a agência é a de quem convidou.

```ts
cadastrar({ ..., criarAgenciaPropria: false });   // ✅ na tela de convite
```

O convidado ficava em duas agências e entrava na própria, vazia. **No banco a
diferença entre as duas linhas foi de 129 ms** — a agência nasceu antes do
vínculo, e a escolha da agência inicial era `membros[0]` de uma consulta sem
`order`, que o Postgres não promete.

O sintoma engana dos dois lados: para quem convidou, o convite parece não ter
funcionado; para o convidado, o sistema parece vazio. As duas chamadas
funcionam — só estão na ordem errada.

Só a correção na tela não cobre tudo. Com confirmação de e-mail ligada o
cadastro não abre sessão, e a criação automática dispara depois, no login
normal. Por isso `garantirAgencia` também pergunta ao banco
(`tenho_convite_pendente()`, `security definer` porque a RLS de `invites` só
deixa owner/admin ler).

Protegido por `tests/convite.test.ts`.

---

### 9. Tela não afirma o que não mediu

O Financeiro do SaaS calculava `MRR = agências × R$ 197` — contando toda
agência criada, inclusive as em teste —, projetava o ARR em cima disso, e
trazia `100% adimplentes`, `+18,4% este mês` e `Ticket Médio R$ 197,00` como
texto fixo. Embaixo, quatro "transações" de agências que nunca existiram na
base: Vanguarda Social, Pixel Mídia, Creative Hub.

**No dia em que isso foi encontrado eram três agências, todas em teste, R$ 0,00
de receita. A tela dizia R$ 591,00.**

Não existe assinatura da agência com o SaaS nem registro de cobrança no banco
— `plans` é outra coisa, é o catálogo que cada agência monta para os clientes
dela. Sem esses dados, qualquer número ali é chute.

Número inventado em tela financeira é pior que tela vazia: ele é usado para
decidir. Enquanto o dado não existir, a tela mostra o que o banco sabe e
**diz o que falta, com nome** — a mesma regra da aba Integrações.

Protegido por `tests/telas-honestas.test.ts`, que varre `src/components`
depois de remover os comentários: o projeto registra o bug nos comentários, e
sem essa limpeza a guarda acusaria a própria memória do bug.

---

## Segurança

### Papel na agência ≠ administrador da plataforma

São eixos diferentes, e já foram confundidos: `gerenciar_saas` vivia no papel
`owner`, que a RPC `criar_agencia` dá a **todo mundo que se cadastra**. Cada
cliente novo enxergava o menu de gestão do SaaS.

- `workspace_members.role` → o que a pessoa faz **dentro** de uma agência
- `platform_admins` → quem administra o **produto**

A tabela `platform_admins` não tem política de escrita de propósito: promover
alguém é operação de banco, não algo que uma sessão autenticada faça.

### Segredo de terceiro nunca chega ao navegador

`social_tokens` tem RLS ligada e **zero políticas** — inalcançável por
qualquer sessão autenticada, inclusive a do dono da agência. Só a função
serverless a lê, com `clienteDeServico()`.

É o único uso da chave de serviço no projeto. Se precisar de outro, pense duas
vezes: ela ignora a RLS inteira.

### Papel vem da sessão, nunca de `user_metadata`

Metadados são editáveis pelo próprio usuário e não servem para autorização.

---

## Como verificar cada camada

**Código:** `bun run lint && bun run test && bun run build`. Os testes de
guarda (`ids`, `rotas-api`, `ordem-de-gravacao`, `automacoes`) protegem
invariantes que não quebram nada visível quando violados — é para isso que
eles existem.

**RLS:** teste impersonando usuários de verdade, não lendo a policy. O padrão
usado no projeto:

```sql
create temp table res (passo text, obtido text, esperado text);
grant all on res to authenticated;

do $$
begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
        json_build_object('sub', '<uuid do usuário>', 'role', 'authenticated')::text, true);
    -- consulta ou escrita, contando linhas afetadas
end $$;

select passo, obtido, esperado,
       case when obtido like esperado || '%' then 'OK' else 'FALHOU' end from res;
```

Sempre inclua o caso do intruso e o da auto-promoção. `42501` é o resultado
esperado quando a policy segura.

**Persistência:** confira no banco, não na tela. A tela mostra o estado
otimista e mente sobre o que foi gravado — foi assim que "0 jobs no banco com
um job na interface" passou despercebido.

---

## Convenções

Código e comentários em **português**. Nomes de domínio em português
(`criarRepositorio`, `dispararAutomacoes`); nomes que espelham o schema ficam
como no banco (`workspace_id`, `job.status`).

Comentário explica **por que**, não o que. Se o código já diz o que faz, o
comentário só ganha espaço registrando a decisão — de preferência o custo de
ter feito diferente.

**Toda entrega atualiza `src/data/changelog.ts`.** A entrada do topo tem que
casar com a `version` do `package.json` — `tests/changelog.test.ts` falha se
divergirem, porque o rodapé passaria a mostrar uma versão que a tela de
novidades não conhece.

Só entra o que existe. A lista anterior vivia dentro do componente e
anunciava "Portal do Cliente com Login via WhatsApp", "Componentes Shadcn/UI
em todo o sistema" e "Exportação de relatório em PDF" — nenhum construído. Um
changelog que descreve intenção é pior que não ter changelog: o cliente cobra
o que leu. Correção conta como entrada; foi boa parte do valor entregue.

### Interface: shadcn/ui na estrutura, cores do projeto

`src/components/ui/button.tsx` segue o formato do shadcn — cva + Slot +
forwardRef, mesma API de `variant`, `size` e `asChild` — para `npx shadcn add`
gerar peças que conversam com o que já existe.

**As variantes não são as do shadcn, e isso é decisão, não descuido.** O
padrão dele pinta tudo com variáveis de tema (`--primary`, `--ring`,
`--background`) e assume a paleta neutra que o `init` instala. Este projeto
nunca teve essas variáveis: usa cor direta do Tailwind, e o roxo é substituído
pela cor da agência em tempo de execução — o portal é whitelabel.

Por isso `components.json` tem **`cssVariables: false`**. Rodar
`npx shadcn init` reescreveria o `src/index.css` com o tema dele e trocaria o
visual do produto inteiro.

As variantes saíram do que já estava em tela, levantado por contagem: a
`primary` é a combinação repetida em 13 botões do app. Ao adicionar variante
nova, faça o mesmo — não invente cor.

Toda tela que depende de configuração externa **diz o que falta**, com o nome
da variável. Nunca finja sucesso: `Configurações → Integrações` consulta
`/api/status` e mostra o estado real do servidor em vez de uma lista fixa.

---

## Mapa

```
src/lib/supabase.ts        cliente único; a chave publicável é pública por definição
src/lib/db.ts              repositórios por entidade, operações por linha
src/lib/mappers.ts         snake_case ↔ camelCase; data vazia vira null
src/lib/sincronizacao.ts   diferenciar() e novoId()
src/lib/permissions.ts     papéis dentro da agência
src/components/ui/button.tsx    primitivo shadcn com as cores do projeto
src/lib/rotas.ts           URL de cada tela; ida e volta aba <-> caminho
src/lib/automacoes.ts      motor: evento tipado → ação
src/context/PostfyContext.tsx   o estado inteiro (~1600 linhas)

api/_lib/auth.ts           usuarioDaRequisicao, clienteDoUsuario, clienteDeServico
api/_lib/ia.ts             IA independente de fornecedor (padrão: OpenRouter)
api/_lib/meta.ts           Graph API da Meta
api/_lib/ssrf.ts           bloqueio de rede interna no webhook

supabase/migrations/       schema é a fonte de verdade; 13 migrações
```

---

## Pendências conhecidas

- **A senha `Sofia&Alice*1802` está no histórico do git** (commits `361b9db` e
  `d40757e`). Saiu do código, mas continua lá. Precisa ser rotacionada — o
  histórico não some sem reescrever a branch.
- **Publicação nas redes depende de revisão de app na Meta** —
  `instagram_business_basic` e `instagram_business_content_publish`, 2 a 4
  semanas cada. Antes disso, dá para publicar na própria conta com o app em
  modo de desenvolvimento e a conta como Instagram Tester.
- **Os e-mails disparam do navegador**, depois de a mudança estar gravada.
  Fechar a aba no meio interrompe o envio. A correção definitiva é um gatilho
  no Postgres chamando a função; fica para quando houver volume.
- **Variáveis de ambiente na Vercel** — veja `.env.example`. A aba Integrações
  mostra quais estão faltando, lendo do servidor.
