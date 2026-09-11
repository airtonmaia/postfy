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

Onze regras. Todas vieram de bugs que chegaram a produção.

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
da fila de publicação nunca morou no `vercel.json` — ele mora no `pg_cron`,
dentro do Postgres (ver **O agendador mora no banco**, abaixo).

O `rewrite` para `/index.html` também mora ali, e é **ele** que faz o F5
funcionar fora da raiz: agora que cada menu tem URL própria, sem o rewrite
recarregar em `/calendario` devolve 404 da Vercel antes de o app existir. O
padrão exclui `/api/` de propósito — engolir esse prefixo faria toda função
serverless devolver HTML.

A **ordem** dos rewrites também é regra: a Vercel avalia de cima para baixo e
para no primeiro que casa, e o coringa `/((?!api/).*)` casa com tudo. Se ele
subir, `/robots.txt` e o desvio dos robôs de prévia de link (por `user-agent`,
para `/api/seo`) deixam de existir — sem erro nenhum, só voltam a servir o
`index.html`.

**E o plano Hobby aceita 12 funções serverless por deploy.** Passar disso não
dá erro de código: `tsc`, vitest e `vite build` ficam verdes — nenhum deles
conta arquivos em `api/` — e **o deploy inteiro falha**, com a produção presa
na versão anterior. A branch da lixeira ficou quatro deploys sem subir por
causa de duas rotas novas, que levaram o total a 14.

Rota nova, portanto, significa **juntar duas que já existem**. Foi o que
aconteceu com a exclusão imediata de agência: virou um modo de
`api/expurgar-lixeira.ts` (GET com o segredo do cron varre; POST com sessão de
admin apaga uma), porque as duas já chamavam a mesma `apagarAgenciaDeVez`. E
foi por isso que a sonda `api/ping.ts` saiu — ela não fazia parte do produto,
e o slot dela era a diferença entre subir e não subir.

`tests/rotas.test.ts` lê o `vercel.json` e confere as quatro coisas — inclusive
que o padrão do desvio casa com `facebookexternalhit` e **não** casa com Chrome
ou Safari — e conta as funções em `api/`. É a única guarda que existe para
esse arquivo e para o limite do plano.

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

### 8.1 Hook depois do `return null` derruba o app inteiro

```tsx
const [aberto, setAberto] = useState(false);   // ✅ todos aqui em cima
if (!isOpen) return null;
// const [texto, setTexto] = useState('');     // ❌ erro #310, tela branca
```

O React exige a **mesma lista de hooks em toda renderização**. Um componente
que faz `if (!isOpen) return null;` e declara `useState` depois disso roda
dois conjuntos diferentes — poucos com a modal fechada, todos quando ela abre
— e o React não degrada: derruba a árvore com `Rendered more hooks than
during the previous render`, que em produção chega minificado como
**`Minified React error #310`**, na tela de erro genérica.

O que torna a armadilha cara é que **nada local acusa**: `tsc` não sabe o que
é hook, o vitest não monta componente, e o `vite build` compila feliz. É a
mesma família da armadilha 0 — tudo verde, produção morta. O projeto não roda
eslint (`bun run lint` é `tsc --noEmit`), então a regra
`react-hooks/rules-of-hooks`, que pegaria isso de graça, não existe aqui.

Só acontece quando o componente **fica montado** com a prop falsa. Se o pai
escreve `{aberto && <Modal/>}`, ele monta e desmonta, e a contagem nunca
diverge. Escrevendo `<Modal isOpen={aberto}/>`, que é o padrão aqui, diverge
sempre. Foi assim nos dois casos que existiram: o botão de teste da
publicação em `CreateJobModal`, e o `useState(defaultMessage)` do
`WhatsAppShareModal` — este último quebrava "compartilhar no WhatsApp" desde
que foi escrito, e ninguém tinha percebido.

A ordem certa é sempre a mesma: **todos os hooks no topo, antes de qualquer
`return`**. Quando o valor inicial depende de algo que só existe depois da
guarda, o estado nasce vazio e um `useEffect` o preenche — que também
conserta o valor velho preso do `useState(x)`, lido só na primeira
renderização.

Protegido por `tests/hooks-antes-do-return.test.ts`.

---

### 8.2 Toda data é do fuso da **agência**, nunca do dispositivo

`workspaces.timezone` ficou desde a primeira migração **sem ninguém ler** —
aparecia como rótulo em duas telas e nada mais. É a mesma classe do
`trial_ends_at`: coluna que parece uma regra e não é.

O que segurava era um acidente. `datetime-local` interpreta no fuso do
navegador, `toLocaleString` também, e a grade do calendário comparava
`getDate()` dos dois lados — tudo no fuso do dispositivo, e portanto coerente
**desde que uma pessoa só, num aparelho só, agende e leia**. Quebra em três
casos que existem:

- membro da equipe em outro estado vê horário diferente do colega, no mesmo
  post;
- o **portal do cliente** formata no fuso do aparelho *dele*: "sai às 10:00"
  vira 11:00 para um cliente em Brasília;
- celular com fuso automático errado agenda errado, sem aviso nenhum.

`src/lib/fusoHorario.ts` guarda o fuso num lugar só, definido **durante a
renderização** do contexto (efeito seria tarde: a primeira pintura após trocar
de agência mostraria o fuso anterior). Os formatadores de `utils.ts` o aplicam
por padrão.

**O padrão é por omissão, e isso é a decisão central.** São 72 pontos que
mostram data, em 26 arquivos; exigir o fuso em cada chamada garantiria
esquecer algum, e esquecer aqui **não quebra nada visível** — mostra o horário
errado com cara de certo. Mesma lógica da persistência derivada de diff: o
caminho certo é o que não exige lembrar de nada.

Três detalhes que custaram tempo:

- **`new Date(':00Z')` devolve 1º de janeiro de 2000**, não data inválida. O
  V8 é permissivo aqui, então `deParedeParaUtc` confere o formato com regex
  **antes** de o `Date` ver o texto — um campo vazio viraria um agendamento em
  2000, que o cron publicaria na primeira passada por já estar vencido.
- **A casinha do calendário é rótulo, não instante.** Ela nasce de
  `new Date(ano, mes, dia)`, meia-noite local; convertê-la pelo fuso a moveria
  um dia. Por isso `chaveDoDia` sai dos números da grade, e quem é convertido
  é o conteúdo.
- **O teste de `descreverBuild` não testava nada disso.** Ele criava a data no
  fuso do runner e conferia a saída no mesmo fuso: os dois lados se
  cancelavam, e ele passava em qualquer máquina sem nunca afirmar em que fuso
  o rodapé deveria estar. Agora o fuso vai explícito em toda asserção.

E a tela de `Configurações → Preferências` **mentia**: o botão de salvar era
`setSaved(true)` e mais nada, seguido de "Preferências salvas com sucesso!".
Nenhuma chamada ao banco. Quatro campos saíram junto — idioma, prazo de
auto-aprovação, prazo padrão de entrega e os dois alertas —, porque nenhum
tinha efeito em lugar nenhum. Campo que não faz nada é pior que campo ausente:
ele é configurado, e a pessoa passa a contar com o que ele promete.

Protegido por `tests/fuso-horario.test.ts`, que reprova qualquer `toLocale*`
de data sem fuso em `src` — depois de remover os comentários, senão a guarda
acusaria a própria memória do bug.

---

### 9.1 O navegador enfileira, o cron envia

O e-mail automático saía do navegador (`emailApi.disparar`) logo depois de a
mudança estar gravada. Fechar a aba no mesmo segundo interrompia o envio: o
conteúdo ficava aprovado e o aviso não saía, sem erro em lugar nenhum.

Agora `dispararAutomacoes` só faz um insert em `email_queue` — que acaba
antes de a aba fechar — e quem envia é `api/publicar.ts`, a mesma rota que o
agendador chama de 5 em 5 minutos. Três tentativas por item; depois disso
fica em `falhou` com o motivo à vista, em vez de ser retentado para sempre.

Note que o e-mail depende do agendador, então **tudo o que atrasa a
publicação atrasa o aviso junto** — foi o que aconteceu enquanto o cron
morava no GitHub Actions (ver a seção do agendador, abaixo).

**O destinatário é congelado no insert.** O modelo diz "cliente" ou
"agência", e quando é a agência o destino é quem está na sessão — o cron não
tem sessão para perguntar isso depois.

Duas coisas que parecem detalhe e não são:

- A tela diz **"e-mail na fila"**, não "enviado". Quem envia é o cron, daqui
  a alguns minutos, e um endereço inválido só se revela lá.
- O **webhook continua saindo do navegador**: ele é ida e volta que a tela
  mostra na hora ("destino respondeu 200"). Enfileirá-lo trocaria uma
  resposta útil por um "na fila" que não diz nada.

`email_queue` não tem política de UPDATE para sessão autenticada, de
propósito: quem marca como enviado é o cron, com a chave de serviço. Uma
política aqui deixaria o navegador afirmar que enviou o que nunca saiu.

A rota `api/send-email.ts` deixou de existir — o corpo dela virou
`api/_lib/emails.ts`, chamável dos dois lados. Isso também devolveu um slot
de função, que é o que o Stripe ocupou (ver armadilha 6).

---

### 9.2 O aviso ao cliente tem dois modos, e o motor é quem decide

Dez peças enviadas na segunda-feira viravam dez e-mails em quinze minutos. O
efeito não é o cliente ficar bem informado — é ele parar de abrir todos, e aí
o aviso que importa se perde junto.

`workspaces.notificacao_aprovacao` escolhe entre `cada` (o de sempre, e o
padrão) e `lote`. No modo de lote **nenhum e-mail automático sai**; quem
avisa é a agência, pelo botão "Aprovação em massa" no quadro.

**A checagem mora em `enfileirarEmail`, não nas telas.** O evento
`conteudo_aguardando_aprovacao` é disparado de vários lugares — o seletor do
card, o detalhe do conteúdo, o botão da modal —, e filtrar em cada um
garantiria esquecer um. Esquecer aqui é o pior caso: o cliente recebe os dois
avisos, e a preferência vira enfeite.

`email_queue` passou a aceitar uma linha que fala de **vários** conteúdos:
`job_id` deixou de ser obrigatório, e entraram `client_id` e `quantidade`. O
check `job_id is not null or client_id is not null` é o que impede a linha
órfã — sem ele, uma linha sem os dois só revelaria o problema na hora de
enviar, tarde demais.

**A contagem é congelada no insert**, pela mesma razão que o destinatário já
era: o cron envia minutos depois, e o número de "depois" já seria outro se
alguém aprovasse no meio-tempo.

O botão exige **um cliente escolhido** no filtro. Com "todos", o lote
misturaria clientes e o aviso iria para quem não deveria ver o conteúdo dos
outros.

Protegido por `tests/fluxo-de-aprovacao.test.ts`.

---

### 10. No portal não há sessão — logo, não há persistência por diff

`useColecaoSincronizada` sai cedo quando `isAuthenticated` é falso. **Toda
mutação feita de dentro do Portal do Cliente morre no estado da aba**: a tela
mostra o resultado, o banco nunca é chamado, e o F5 apaga tudo sem erro
nenhum. Foi assim que o envio de material do cliente ficou decorativo por
meses — a galeria exibia o arquivo, `client_materials` não tinha a linha.

Quem grava ali é RPC `security definer`, com o token da sessão como
credencial:

```ts
if (noPortal) { void gravarClienteNoPortal({ passwords: proximas }); return; }
```

`noPortal` (`portalToken && !isAuthenticated`) fica no contexto, num lugar só.
Mutação nova que o portal possa disparar precisa do desvio — ou volta a ser
uma tela que mente sobre o que gravou.

E o recorte por papel é do **banco**, não da tela: `portal_dados` não devolve
`passwords`, `invoices`, `briefing` nem `files` para o aprovador. Esconder aba
com o dado já no navegador seria a armadilha 9 outra vez. `portal_token`
também não sai mais de lá, para papel nenhum.

Protegido por `tests/usuarios-do-cliente.test.ts`, que lê a migração depois de
remover os comentários e confere o recorte, o papel em cada escrita, os
`grant ... to anon` e que cada `supabase.rpc` do portal aponta para função que
existe — nome de RPC é string, e um erro de digitação só aparece na frente do
cliente.

---

---

## Performance: o gargalo é o que se carrega, não o que se guarda

`carregarTudo` puxava a agência **inteira** em toda sessão — todos os jobs,
logs, notificações, materiais e apontamentos, sem limite e sem paginação. Com
100 jobs é instantâneo; com 5.000 o login demora segundos e **cada edição**
passa pelo `diferenciar()`, que faz um `JSON.stringify` por linha.

O que torna isso perigoso é que não dependia de a agência crescer. Nada era
arquivado, então toda agência caminhava para lá só pelo tempo de uso.

**A regra que substitui isso: trabalho aberto sempre vem; trabalho concluído
só o recente.** Uma agência com três anos tem dezenas de jobs abertos e
milhares de publicados, e são os abertos que a tela precisa para funcionar.
`DIAS_DE_HISTORICO = 90` em `src/lib/db.ts`.

Clientes, leads, propostas e contratos continuam vindo inteiros, de
propósito: são limitados pelo tamanho do negócio, não pelo tempo. Paginá-los
quebraria o seletor de cliente e o funil sem ganho nenhum.

### O que sai da janela é buscado sob demanda — com a bandeira ligada

Calendário navegando para trás e relatório de período longo chamam
`garantirJobsDoPeriodo`, que busca o que falta e junta ao estado.

**A bandeira `aplicandoCargaDoBanco` é obrigatória ali.** Sem ela o
`useColecaoSincronizada` vê linhas novas no estado e as trata como inserção —
tentaria gravar de volta tudo que acabou de ler, e a chave primária recusaria
uma a uma, em silêncio, dentro da fila de gravação. É a mesma razão de a
carga inicial levantá-la.

### Cache: quase nenhum, e não no navegador

O estado em memória do React já é o cache da sessão. A armadilha 4 proíbe
`localStorage` para dado de agência, e o ganho de guardar mais é pequeno
perto do de carregar menos — foi por isso que a resposta aqui foi janela, e
não cache.

Dois lugares onde ele vale, e são os dois que já existem:

- **`carregarAparencia()`** é memoizada por sessão. É a consulta mais chamada
  do produto — entrada, cadastro e porta do portal são anônimas e a leem em
  toda abertura — e devolve uma linha que muda quando o dono mexe no Design.
  `esquecerAparencia()` limpa depois de salvar, senão quem trocou o logo
  continuaria vendo o antigo.
- **`api/seo.ts`** responde com `cache-control: public, max-age=300`, para o
  robô de prévia não bater no banco a cada compartilhamento.

**Redis não entra.** Não há servidor de aplicação onde ele ficaria: o
navegador fala direto com o Supabase, e as funções serverless são efêmeras —
um cache dentro delas nasce frio e morre em minutos. O único caso legítimo
seria limite de taxa global entre containers, e esse já é resolvido contando
em `portal_codigos`.

### O agendador tem orçamento de tempo, não lote fixo

`api/publicar.ts` publicava `LOTE = 10` por passada. Lote fixo só funciona se
a estimativa de tempo estiver certa: alto demais estoura o tempo da função
**no meio de uma publicação** — a peça vai ao ar e a fila não sabe, que é o
pior desfecho desta rota —, baixo demais segura a fila no pico, e todo mundo
agenda para 9h e 18h.

Agora a passada publica o que couber em `ORCAMENTO_MS` (45s numa função de
60s) e para. O resto é o primeiro da próxima, cinco minutos depois. A
resposta traz `adiados`: diferente de zero de forma seguida é o sinal de que
cinco minutos já não bastam.

Protegido por `tests/carregamento.test.ts`.

---

## O agendador mora no banco, e isso foi medido

`/api/publicar` é a rota que publica a fila, renova os tokens do Instagram e
esvazia `email_queue`. Ela não se chama sozinha — alguém precisa bater nela
de 5 em 5 minutos.

Esse alguém **já foi o `schedule` do GitHub Actions**, e o número que tirou
ele de lá:

| | |
|---|---|
| workflow ativo | 52,6 horas |
| passadas que `*/5` pedia | 631 |
| passadas reais | **15** |
| taxa | **2,4%** |

Intervalos reais de 2 a 5 horas entre uma passada e outra. O comentário que
estava no workflow assumia o contrário — "pode atrasar sob carga, aceitável
para post agendado, que já tolera minutos". Tolera minutos; não tolera horas.
Um post marcado para as 10:00 saindo às 14:00 é a agência explicando ao
cliente dela.

**Não era erro de configuração.** O `schedule` do GitHub é best-effort por
definição, e a documentação deles diz isso. Para CI não custa nada; para hora
de publicação, custa tudo. A lição que fica é mais ampla: *serviço grátis
best-effort não vira compromisso de produto porque o cron está escrito
certo.*

Quem agenda agora é o **`pg_cron`**, no Postgres que já é nosso — sem
fornecedor novo e sem o segredo sair de casa. O cron da Vercel seria o lugar
natural e não serve: conta Hobby só aceita cron diário, e `*/5` derruba o
deploy inteiro (armadilha 6).

Três coisas que não são detalhe:

- **O `CRON_SECRET` vive no Vault do Supabase, nunca na migração.** Migração
  é arquivo versionado, e o projeto já carrega uma senha no histórico do git
  por ter esquecido isso uma vez. `private.disparar_publicador()` lê
  `vault.decrypted_secrets` pelo nome; quem cadastra o valor é uma pessoa, no
  SQL Editor, fora do git. O comando está no cabeçalho da migração.
- **Um agendador só.** O `schedule:` saiu de `publicar.yml` de propósito —
  deixá-lo "como reserva" faria os dois esconderem a morte um do outro, e o
  `pg_cron` parado passaria despercebido enquanto posts saíssem atrasados.
  Com um só, a parada aparece na fila da tela de Publicações, em pendente. O
  `workflow_dispatch` continua, para disparar à mão ao testar.
- **A passada é assíncrona.** `net.http_get` enfileira e volta na hora, então
  o cron não fica preso nos 45 s de orçamento da função. A resposta cai em
  `net._http_response`.

Onde olhar quando a publicação não sai:

```sql
select start_time, status, return_message
  from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'publicar-fila')
 order by start_time desc limit 20;

select created, status_code, content::text
  from net._http_response order by created desc limit 20;
```

`status_code` 401 significa que o valor no Vault e o da Vercel divergiram —
o mesmo sintoma que derrubava o workflow.

### `extensions.net.http_get` não é schema errado — é nome de três partes

`create extension pg_net with schema extensions` registra a extensão ali, mas
as funções **não** vão junto: o pg_net fixa o schema `net` no próprio control
file, e é em `net.http_get` que elas ficam. Escrever `extensions.net.http_get`
faz o Postgres ler *banco*.*schema*.*função* e recusar com
`0A000: cross-database references are not implemented`.

O que torna isso caro é o momento em que aparece. **A migração aplica limpa**:
PL/pgSQL só resolve nome na execução, então `create or replace function`
aceita o corpo sem conferir nada e o `cron.schedule` grava. A primeira falha
chega na primeira passada, como uma linha em `cron.job_run_details` que
ninguém abre — nada publica, a fila enche de `pendente`, e não há erro em
lugar nenhum. Exatamente o sintoma que o `pg_cron` veio resolver.

`net` também precisa estar no `search_path` da função: ela é `security
definer` com caminho fixo, então o schema não entra por herança da sessão.

**E migração escrita não é migração aplicada.** Esta ficou quatro commits no
repositório sem nunca ter sido aplicada — com o `schedule:` do GitHub já
removido, o produto passou esse tempo **sem agendador nenhum**. A regra do
banco compartilhado corta nos dois sentidos: aplicar cedo demais quebra a
`main`, e aplicar nunca desliga o produto em silêncio. Antes de fechar a
entrega, confira no banco (`select * from cron.job`), não no arquivo.

`tests/agendador.test.ts` já existia e conferia a **fiação de fora** — um
`cron.schedule` só, com `unschedule` antes, workflow sem `schedule`,
`vercel.json` sem `crons`, segredo fora do git. Nada olhava para dentro do
corpo da função, que é onde o erro estava. Agora olha: o disparo tem que usar
`net.http_get` com `net` no `search_path`, e nenhuma migração pode conter nome
de três partes.

---

## Instagram: é o login do **Instagram**, não o do Facebook

Existem dois caminhos para publicar, e escolher o errado não dá erro nenhum
até a pessoa já ter digitado a senha:

| | login do Facebook | **login do Instagram** ← o nosso |
|---|---|---|
| entra com | conta do Facebook | conta do Instagram |
| exige Página | sim | não |
| token que publica | o **da Página**, via `/me/accounts` | o da conta |
| autorização | `www.facebook.com/.../dialog/oauth` | `www.instagram.com/oauth/authorize` |
| troca do código | `graph.facebook.com` (query) | `api.instagram.com` (**POST form**) |
| chamadas | `graph.facebook.com` | `graph.instagram.com` |
| app id | o do app da Meta | **outro**, em Instagram → Configuração da API |

O projeto nasceu com o primeiro implementado e o segundo configurado na
Meta. A prova de qual é o nosso está no teste manual que passou: `/me`
devolveu `28732739896414585` e **esse mesmo id** publicou em `/media`. No
fluxo do Facebook, `/me` devolve o usuário do Facebook, e um POST em
`/{id-do-facebook}/media` é recusado.

Três armadilhas dentro dessa, todas com o mesmo sintoma — falha depois do
login, com mensagem que não nomeia a causa:

1. **`INSTAGRAM_APP_ID` não é `META_APP_ID`.** São apps diferentes, com ids
   diferentes, no mesmo painel.
2. **`pages_show_list` e `pages_read_engagement` invalidam a autorização.**
   São escopos do fluxo do Facebook. Só `instagram_business_basic` e
   `instagram_business_content_publish` entram.
3. **A URL de retorno tem que bater caractere a caractere** entre o que
   mandamos ao abrir a autorização, o que mandamos ao trocar o código e o que
   está cadastrado no painel. `Admin → Integrações` mostra o valor exato,
   vindo do servidor, com botão de copiar — escrito à mão na tela ele
   envelheceria, e o valor certo depende de `APP_URL`.

### Publicar são dois passos, e o segundo espera o primeiro — para foto também

`POST /{conta}/media` cria um **contêiner**: a Meta guarda a URL e vai
**baixar e processar** o arquivo por conta dela. `POST /{conta}/media_publish`
só funciona depois que esse processamento termina. Publicar antes devolve

```
The media is not ready for publishing, please wait for a moment
```

A espera existia aqui **só para vídeo**, com a suposição de que foto fica
pronta na hora. Não fica — e foi essa a falha da primeira publicação real.

O que torna essa armadilha cara é depender de tempo: com a mídia já no cache
da Meta o erro não acontece, então **o mesmo conteúdo falha na primeira
tentativa e passa na segunda**. Um bug que some quando você repete é o que
mais custa para diagnosticar, e leva direto a culpar a rede, o R2 ou o token.

`esperarProcessamento` consulta `status_code` do contêiner até `FINISHED`, com
teto de tempo — sem teto a função serverless estoura, e estourar no meio é o
pior desfecho, porque o post pode ter saído e a fila não fica sabendo.
`ERROR` e `EXPIRED` param na hora, com o motivo que a Meta dá em `status`.

Protegido por `tests/instagram.test.ts`, que reprova a espera voltando a ser
condicional ao vídeo.

O token de longa duração vale **60 dias e é renovável**. `api/publicar.ts`
renova o que vence em menos de 10 dias, em toda passada do agendador, e olha
todas as conexões — não só as que têm item na fila, porque é justamente quem
não publica há tempos que corre o risco. Sem isso a conta cai sozinha depois
de dois meses, e o sintoma é a publicação agendada falhando de madrugada.

Protegido por `tests/instagram.test.ts`, que varre os arquivos **depois de
remover os comentários** — o porquê de cada host do Facebook ter saído está
registrado neles.

### O agendador tinha tudo, menos as duas pontas

Publicar de verdade precisa de três peças, e por meses existiam só a do meio:

1. **Alguém põe na fila.** `agendarPublicacao` existia **sem nenhum chamador**.
   A `publish_queue` nunca recebeu uma linha, então `api/publicar.ts` rodava de
   cinco em cinco minutos sobre uma fila vazia e não publicava nada — nem no
   Instagram. O card ficava "Agendado", a data passava, e a peça não ia ao ar.
   A tela ainda chamava de "fila de disparos" a lista de jobs com status
   `scheduled`, que é outra coisa: uma fila de mentira em cima de uma fila
   vazia.
2. **O cron publica.** Esta parte estava pronta desde o começo.
3. **A conta tem dono.** `social_connections.client_id` estava no schema e
   **ninguém escrevia** — toda conexão nascia órfã. Sem saber de quem é a
   conta, não há como escolher o perfil: todo conteúdo tem cliente, e uma
   conexão sem cliente não publica coisa nenhuma. É a mesma classe de bug de
   `trial_ends_at`: coluna que parece uma regra e não é.

Três decisões que saíram disso:

- **Enfileirar é um clique, nunca um efeito.** Não sai de `useEffect`, nem de
  arrastar o card para "Agendado". Postagem publicada no perfil do cliente não
  volta, e um disparo automático a partir de um render é a forma mais barata de
  publicar o que ninguém decidiu publicar. O botão mostra em qual `@conta` e em
  que data.
- **E tem porta de saída.** `cancelarPublicacao` também existia sem chamador;
  agora a fila tem "tirar da fila" enquanto o item não foi ao ar. Só para
  `pendente` e `falhou` — apagar um `publicado` apagaria o histórico.
- **O cliente da conta viaja no `state` assinado**, nunca na query do retorno.
  Quem chega em `api/social-callback.ts` veio da Meta, sem sessão: um
  `clientId` na URL seria escolhido por quem quisesse, e postaria o conteúdo de
  um cliente no perfil de outro. A rota confere pela RLS que o cliente é da
  agência **antes** de assinar.

`REDES_QUE_PUBLICAM` em `src/lib/redes.ts` é a fonte única de quem publica
sozinho, e hoje tem **só o Instagram**. `tests/publicacao.test.ts` falha se uma
rede entrar nessa lista sem `publicarNo<Rede>` existir no servidor — a tela
deriva dela o que dizer, então acrescentar um nome ali é prometer disparo.

**O Facebook não é "mais um nome na lista".** É outro fluxo de OAuth, outro app
id, e outra revisão na Meta: quem publica numa Página é o token **da Página**,
obtido por `/me/accounts` no login do Facebook, com `pages_show_list`,
`pages_read_engagement` e `pages_manage_posts`. Esses escopos **invalidam a
autorização do Instagram** se forem misturados no fluxo atual (armadilha 2 da
tabela acima), e `api/_lib/meta.ts` — que tinha esse caminho — foi apagado de
propósito em `e9e7792`. Fazer os dois é ter dois fluxos convivendo, não um
parâmetro a mais.

---

## Cobrança: `subscriptions` é a agência com o produto, `plans` é outra coisa

Os dois nomes parecem a mesma coisa e não são. Confundi-los é o caminho mais
curto para um número errado numa tela financeira:

| | o que é | quem escreve |
|---|---|---|
| `plans` | o catálogo que **cada agência** monta para os clientes dela | a agência, pela tela de Planos |
| `subscriptions` | a assinatura **da agência com o Orquesia** | só o webhook do Stripe |

`subscriptions` tem RLS ligada e **nenhuma política de escrita** para sessão
autenticada — só SELECT, para a agência ver a própria e o admin da plataforma
ver todas. Uma política de update aqui deixaria qualquer dono de agência se
marcar como pagante. Quem escreve é `api/assinatura.ts`, com a chave de
serviço, a partir do que o Stripe responde.

**O MRR é somado no banco** (`admin_numeros_de_cobranca`), nunca calculado na
tela. Era o cálculo local — `agências × R$ 197` — que dizia R$ 591,00 num dia
de R$ 0,00. `tests/telas-honestas.test.ts` falha se um `const mrr =` voltar
ao componente.

### O webhook não confere a assinatura do jeito padrão, e isso é de propósito

`stripe.webhooks.constructEvent` exige o corpo **byte a byte** como o Stripe
assinou. Não temos isso: a Vercel entrega o corpo já parseado e
`api/_lib/rota.ts` o re-serializa com `JSON.stringify` (armadilha 1). Ordem de
chaves e espaços mudam, e a conferência falharia em 100% das chamadas — o
pior tipo de falha, porque pareceria ataque.

A saída é **mais forte**, não mais fraca: nada do corpo é gravado. O corpo só
diz "olhe a assinatura X"; em seguida a rota busca essa assinatura na API do
Stripe, autenticada com a nossa chave, e grava o que **eles** responderem. Um
corpo forjado não escreve dado falso — ou o id não existe lá, ou existe e o
que gravamos é a verdade do Stripe de qualquer jeito.

Quando o corpo cru sobrevive, a assinatura é conferida também. Não custa nada.

### O teste grátis: duas metades, e as duas precisam existir

`workspaces.trial_ends_at` ficou no schema desde o começo **sem ninguém
escrever nem ler**. Nenhuma agência tinha data, `criar_agencia` inseria só
nome e slug, e nada no app bloqueava. Quem lesse o schema concluiria que
havia limite de teste — e a 2.16.0 chegou a anunciar que o teste passava a
terminar, sem que terminasse.

Uma coluna que parece uma regra e não é engana mais que a ausência dela. Para
o teste existir de verdade são necessárias as duas metades:

1. `criar_agencia` carimba `trial_ends_at = now() + 14 dias` e `is_trial`.
2. `App.tsx` consulta `acesso_da_agencia()` e monta `AcessoBloqueado` quando
   `liberado` é falso.

Três regras do bloqueio, todas na mesma direção:

- **Só bloqueia com resposta do banco.** `acessoDaAgencia` em `null` — consulta
  pendente ou que falhou — passa direto. Derrubar quem está trabalhando porque
  a rede oscilou é pior que deixar passar quem não pagou. O guard é
  `acessoDaAgencia && !acessoDaAgencia.liberado`, nunca `!…?.liberado`.
- **Depois do `/admin` e do portal.** O dono do produto não pode perder a
  própria área por causa de uma agência de teste dele, e o cliente que entra no
  portal não decide nada sobre a cobrança da agência.
- **Sempre há porta de saída.** Quem pode assinar vê o botão, quem não pode vê
  de quem cobrar, e sair da conta está sempre disponível. Bloqueio sem saída é
  armadilha, não cobrança.

**Agências criadas antes disto continuam sem data, e é decisão.**
`trial_ends_at` nulo vale como teste aberto. Carimbar uma data retroativa
derrubaria de uma vez gente que nunca foi avisada de que havia prazo.

Protegido por `tests/assinatura.test.ts`.

### Uma rota para três coisas

`api/assinatura.ts` é checkout, portal de cobrança **e** webhook, separados
pelo cabeçalho `stripe-signature` e pelo campo `acao`. É o limite de 12
funções da armadilha 6: o webhook precisa de URL fixa (é ela que vai
cadastrada no painel do Stripe), então é ele quem define o caminho.

`STRIPE_WEBHOOK_SECRET` é o único que **não se resolve na Vercel** — ele nasce
no painel do Stripe no momento em que o endpoint é cadastrado lá. Por isso
`Admin → Integrações` mostra a URL exata com botão de copiar, como faz com a
URL de retorno da Meta.

---

## Duas marcas, e elas não se misturam

`saas_settings` (uma linha só) é a cara do **produto**: a marca do Orquesia, a
paleta, as artes das telas de entrada, o que vai para os buscadores. Escreve
quem está em `platform_admins`; lê qualquer um, mas por
`aparencia_do_saas()`, função de lista fechada — a tela de entrada é anônima
por definição.

`workspaces` (logo, cores, favicon) é a cara de **cada agência**, e é ela que
pinta o portal do cliente daquela agência.

**A agência sobrepõe o produto, nunca o contrário** (`DynamicThemeProvider`).
A paleta do SaaS vale onde não há agência aberta: entrada, cadastro, porta do
portal e a área `/admin`. Sobrepor na direção oposta apagaria a marca que o
cliente da agência espera ver — que é o motivo de o whitelabel existir.

A tela de Design diz isso em texto, e não por acaso: prometer "personalize o
SaaS inteiro" e repintar só metade seria a armadilha 9 de novo.

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

### Git: duas máquinas no mesmo repositório

O trabalho acontece em **mais de uma máquina**, e às vezes com uma IA em cada
uma. Nenhuma das regras abaixo é preferência de estilo: cada uma existe
porque a falta dela já custou tempo aqui.

**Nunca trabalhe direto na `main`.** Branch sempre, mesmo para uma linha. A
`main` é o que está em produção — o merge nela *é* o deploy. Empurrar direto
para "subir rápido" tira a única revisão que existe (o CI no PR) e, com duas
máquinas, é a forma mais rápida de a outra perder trabalho num pull.

**Antes de começar, traga a `main`.** Sua cópia local está desatualizada por
padrão:

```bash
git fetch origin main && git checkout -B vN.N origin/main
```

Sem isso a branch nasce de um passado, e o conflito só aparece no merge —
depois de a entrega estar pronta.

**Uma entrega, uma branch, um PR.** O nome segue `vN.N` (v3.4, v3.5, v3.6).

**Nunca `force-push` em branch que já foi empurrada.** Do outro lado pode
haver uma cópia; reescrever o histórico dela apaga trabalho sem aviso.

#### A versão é decidida no merge, não no começo

Já aconteceu **duas vezes**: `v3.4` e `v3.5` reivindicaram a 2.10.0, e `v3.6`
e a `main` reivindicaram a 2.13.0. As duas branches estavam certas quando
começaram — a `main` andou no meio.

`tests/changelog.test.ts` exige que o topo do changelog case com a `version`
do `package.json`, então o conflito é garantido e barulhento (o que é bom).
Resolva assim:

1. A entrada que **já está na `main`** mantém o número dela.
2. A sua sobe para o próximo, e vira o topo.
3. As duas entradas ficam. Nenhuma é apagada — cada uma descreve uma entrega
   que existiu.

O commit de merge diz o que foi renumerado, para o próximo conflito não
começar do zero (`merge: traz a main e renumera para 2.15.0`).

#### O banco é compartilhado — e é produção

Não existe banco de desenvolvimento. As duas máquinas falam com o **mesmo**
Postgres, que é o que está no ar. Consequências que não são óbvias:

- **Migração aplicada de uma máquina vale para a outra na hora**, mesmo que a
  branch dela não tenha o arquivo. Aplique quando o código que depende dela
  estiver perto de entrar, não no começo do trabalho.
- **Escreva toda migração como repetível**: `create table if not exists`,
  `create or replace function`, `drop policy if exists` antes de `create
  policy`. Quem for aplicar de novo — ou a outra máquina, sem saber que já
  foi — não pode quebrar nada.
- **Nunca remova coluna ou função que a `main` ainda usa.** A `main` está no
  ar: um `drop` derruba produção antes de o seu PR existir. Se precisar sair,
  sai depois que o código que a lia já não estiver mais publicado.
- **Dado de teste com prefixo e contagem antes/depois.** O banco é o de
  produção; `qa-...` no nome e conferir o total antes e no fim é o que separa
  "testei" de "mexi na base do cliente".

#### O orçamento de funções serverless é compartilhado

São **12 no total** (armadilha 6), e o número é do produto, não da branch.
Duas máquinas acrescentando uma rota cada estouram o limite mesmo que cada PR
pareça inocente. `tests/rotas.test.ts` acusa antes do deploy — mas quem vai
precisar de rota nova avisa a outra máquina primeiro, porque a solução é
sempre juntar duas que já existem, e isso é decisão de desenho.

### Uma linha visual só: o desenho do dashboard

**Tela nova copia o desenho que já existe. Não invente nada.** Nem raio de
canto, nem sombra, nem espaçamento, nem tamanho de fonte, nem tom de cinza.
Se a peça que você precisa já está em tela em algum lugar, ela é a resposta —
copie as classes.

O que "o desenho do dashboard" significa, levantado por contagem no `src`:

| peça | classe | onde |
|---|---|---|
| fundo de tela | `bg-slate-50 dark:bg-slate-950` | 175 usos |
| superfície de card | `bg-white dark:bg-slate-900` | 200 usos |
| borda e canto de card | `rounded-2xl border border-slate-200 dark:border-slate-800` | 87 usos |
| respiro da tela | `p-6 md:p-8 space-y-6` | todas as telas de conteúdo |
| barra lateral | `w-64` | casca da agência e casca do `/admin` |
| cabeçalho | `h-14` | idem |
| item de menu | `px-3 py-2 rounded-xl text-xs font-semibold` | idem |
| botão primário | `bg-purple-600 hover:bg-purple-700 text-white` | 13 botões |

`rounded-xl` é o canto **interno** — campo, botão, item de menu. `rounded-2xl`
é o canto do card. Os dois convivem; um terceiro não.

A regra vale para casca também: a área `/admin` tem barra lateral e cabeçalho
próprios porque o **conteúdo** é outro, e nenhum pixel de medida foi mudado
por isso. Foi de propósito — casca nova com medida nova faria a mesma pessoa
achar que trocou de produto ao clicar num botão.

Isto não é gosto. Cada valor solto — um `rounded-3xl` aqui, um `p-5` ali —
custa pouco sozinho e fica; depois de vinte deles ninguém consegue mais dizer
qual é o padrão, e cada tela nova vira uma decisão do zero. O momento de
recusar é o primeiro.

Cor nova segue a mesma regra da variante de botão: sai do que já está em tela,
levantado por contagem. Nunca inventada.

### Interface: shadcn/ui na estrutura, cores do projeto

`src/components/ui/button.tsx` segue o formato do shadcn — cva + Slot +
forwardRef, mesma API de `variant`, `size` e `asChild` — para `npx shadcn add`
gerar peças que conversam com o que já existe.

#### As variáveis do shadcn existem, e o valor delas saiu da contagem

O projeto nasceu com **`cssVariables: false`**, e o motivo era real: o padrão
do shadcn pinta tudo com `--primary`, `--ring` e `--background`, assumindo a
paleta neutra que o `init` instala — enquanto aqui o roxo vira a cor da agência
em tempo de execução, porque o portal é whitelabel. Rodar `npx shadcn init`
teria reescrito o `src/index.css` com o tema dele e trocado o visual inteiro.

O custo disso só apareceu depois: **peça gerada por `npx shadcn add` nasce
escrita contra as variáveis.** Sem elas, cada componente novo precisava de
tradução à mão — ou nascia roxo num portal que não é roxo. Com três peças em
`src/components/ui` e 339 `<button>` escritos à mão, a conta ainda fechava;
com a casca e os diálogos entrando, não fecha mais.

A saída não foi adotar a paleta do shadcn, foi **declarar as variáveis com os
valores que já estavam em tela**, levantados por contagem: `--background` é o
`slate-50` de 175 usos, `--card` é o `bg-white` de 200, `--border` é o
`slate-200` de 87, `--primary` é o roxo dos 13 botões. `--radius` é `0.75rem`,
que é o `rounded-xl` do projeto — assim peça nova nasce no canto certo em vez
do `0.625rem` do padrão. Nada mudou de cor: mudou de onde a cor vem.

Duas coisas seguram isso de pé, e nenhuma delas quebra o build quando falha:

- **`@theme inline` é o que transforma variável em classe.** O Tailwind v4 gera
  utilitário a partir do que está em `@theme`; uma variável declarada no
  `:root` e ausente dali não vira `bg-primary`, e o botão sai **transparente**
  com `tsc`, vitest e `vite build` os três verdes. É a armadilha 0 de novo.
- **`DynamicThemeProvider` escreve os dois conjuntos de nomes**: `--brand-*`,
  que alimenta a folha de `!important` dos botões escritos à mão, e
  `--primary`/`--ring`/`--sidebar-primary`, que é o que as peças do shadcn
  leem. Saem da mesma `currentWorkspace.primaryColor`, então não podem
  divergir. **Apagar um dos lados antes da hora é o erro caro:** a tela
  continua pintada, com o roxo do Orquesia no lugar da marca do cliente, e
  ninguém abre chamado porque *parece* certo.

**A marca tem o mesmo tom no claro e no escuro, e isso é decisão.** O shadcn
clareia o `--primary` no escuro porque o primário dele é um neutro; aqui ele é
a cor da agência, e os 99 `bg-purple-600` escritos à mão seguem no tom cheio
nos dois modos. Clarear só o lado do shadcn colocaria dois roxos diferentes na
mesma tela — o oposto do que a padronização veio resolver.

Por isso a folha injetada escreve **só `:root`**, sem um `.dark` ao lado, e
ainda assim vale no escuro: `@layer base` guarda as duas versões no
`index.css`, e **fora de camada vence dentro de camada independente de
especificidade**. Isso foi medido no Chromium, não deduzido — com `.dark` no
`<html>` e a folha trazendo só `:root`, é o valor injetado que
`getComputedStyle` devolve.

`--primary-foreground` é decidido por luminância, não fixo em branco. A folha
de `!important` não conseguia fazer isso: fundo e texto são classes separadas
(`bg-purple-600` e `text-white`), então uma agência de marca clara ficava com
texto branco sobre fundo claro, ilegível, e nada avisava. A variável carrega o
par; a classe carregava só a cor.

**Migrar só onde a variável é pelo menos tão boa.** A variante `soft` do botão
continua em classe roxa de propósito: `text-primary` sobre card escuro dá 2,7:1
de contraste, e a folha de `!important` já entrega 9,9:1 porque tem uma linha
para `.dark .text-purple-300`. Não há variável para o tom claro da marca, e
inventar uma é o que a regra de desenho proíbe. Trocar ali seria deixar mais
moderno e menos legível.

**O neutro continua escrito em `slate`.** `--foreground` é `slate-900` e
`--muted-foreground` é `slate-500`; os degraus intermediários que os botões
usam (`slate-600`, `slate-700`) não têm variável no conjunto do shadcn, e
inventar uma para cada um traria de volta o problema que a contagem resolveu.
`baseColor: "slate"` no `components.json` é o que mantém peça gerada e peça à
mão na mesma escala.

A migração é **tela por tela**, e é isso que as duas formas convivendo
permitem. Ao mexer numa tela, troque o roxo à mão pela variável; a folha de
`!important` sai sozinha quando o último `bg-purple-` sair — a guarda que a
exige se aposenta no mesmo instante.

Protegido por `tests/tema-shadcn.test.ts`.

As variantes de `button.tsx` saíram do que já estava em tela, levantado por
contagem: a `primary` é a combinação repetida em 13 botões do app. Ao
adicionar variante nova, faça o mesmo — não invente cor.

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
src/lib/aparencia.ts       marca, paleta, banners e SEO do produto (saas_settings)
src/lib/numerosDoSaas.ts   contagens do produto inteiro e por agência, via RPC de admin
src/lib/lixeira.ts         prazo da lixeira de agências, o mesmo que o expurgo cumpre
src/lib/assinatura.ts      acesso da agência ao produto, e o link do checkout
src/components/common/AcessoBloqueado.tsx  a tela de teste vencido, com a saída à mão
src/components/admin/      a área /admin: casca própria + as nove telas
src/components/clients/ClientUsersTab.tsx  quem do cliente entra no portal, e com que papel
src/lib/automacoes.ts      motor: evento tipado → ação
src/context/PostfyContext.tsx   o estado inteiro (~1600 linhas)

api/_lib/auth.ts           usuarioDaRequisicao, clienteDoUsuario, clienteDeServico
api/_lib/ia.ts             IA independente de fornecedor (padrão: OpenRouter)
api/_lib/instagram.ts      OAuth e publicação, no fluxo do login do Instagram
api/_lib/stripe.ts         cliente do Stripe e a tradução do status dele para o nosso
api/assinatura.ts          checkout, portal de cobrança e webhook, numa função só
api/_lib/ssrf.ts           bloqueio de rede interna no webhook
api/_lib/emails.ts         monta e envia o e-mail do sistema; esvazia a fila
api/seo.ts                 meta tags para robô de prévia + /robots.txt
api/expurgar-lixeira.ts    varre a lixeira (cron) e apaga uma agência (admin)

supabase/migrations/       schema é a fonte de verdade; 33 migrações
```

---

## Pendências conhecidas

- **A senha `Sofia&Alice*1802` está no histórico do git** (commits `361b9db` e
  `d40757e`). Saiu do código, mas continua lá. Precisa ser rotacionada — o
  histórico não some sem reescrever a branch.
- **Publicação em conta de cliente depende de revisão de app na Meta** —
  `instagram_business_basic` e `instagram_business_content_publish`, 2 a 4
  semanas cada. Com o app em modo de desenvolvimento dá para publicar nas
  contas adicionadas como testador do Instagram, que é como o fluxo foi
  conferido de ponta a ponta.
- **Variáveis de ambiente na Vercel** — veja `.env.example`. A aba Integrações
  mostra quais estão faltando, lendo do servidor.
