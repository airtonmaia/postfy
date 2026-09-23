-- ---------------------------------------------------------------------
-- A autorização do Facebook que ainda não virou conexão
--
-- Conectar uma Página passou a ter dois passos: a pessoa autoriza na Meta e
-- **escolhe** qual das Páginas dela o Orquesia vai usar. Entre um passo e o
-- outro existe um token do usuário — o que lista as Páginas, não o que
-- publica —, e ele precisa esperar em algum lugar.
--
-- **Esse lugar não é o navegador.** O código da Meta é de uso único: depois
-- de trocado, o token é a única forma de voltar em `/me/accounts` e pegar o
-- token da Página escolhida. Mandá-lo para a tela num campo escondido o
-- colocaria no DOM, no histórico e em qualquer captura — e a regra deste
-- projeto é que segredo de terceiro nunca chega ao navegador. O que vai para
-- a tela é só o `id` desta linha, que não abre nada sozinho: o passo dois
-- exige também o `state` assinado, e é dele que saem a agência e o cliente.
--
-- RLS ligada e **zero políticas**, como `social_tokens` e `portal_codigos`:
-- inalcançável por qualquer sessão autenticada, inclusive a do dono da
-- agência. Só a função serverless a lê, com a chave de serviço.
--
-- A linha morre em minutos: ela é apagada no passo dois, e as vencidas saem
-- na próxima autorização que passar por aqui. Um token de usuário esquecido
-- numa tabela é exatamente o tipo de sobra que ninguém vê envelhecer.
-- ---------------------------------------------------------------------
create table if not exists public.social_autorizacoes_pendentes (
    id uuid primary key,
    -- O token **do usuário**, que só serve para listar as Páginas. O da
    -- Página é buscado no passo dois e vai direto para `social_tokens`.
    access_token text not null,
    -- Segundos que a Meta informou. Vira `expires_at` da conexão no passo
    -- dois, e é por isso que ele viaja: perdê-lo faria a renovação nascer
    -- sem prazo.
    expira_em integer,
    criado_em timestamptz not null default now()
);

alter table public.social_autorizacoes_pendentes enable row level security;

-- A varredura é por tempo, e o índice é o que a mantém barata quando a
-- tabela acumula por algum motivo que ninguém previu.
create index if not exists social_autorizacoes_pendentes_criado_em_idx
    on public.social_autorizacoes_pendentes (criado_em);
