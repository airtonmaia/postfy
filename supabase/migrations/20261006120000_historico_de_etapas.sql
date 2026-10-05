-- Quanto tempo a peça ficou em cada etapa — e quem a moveu.
--
-- O produto sabia em **que** etapa o conteúdo está e não sabia **quando** ele
-- chegou nela. "Esta peça está parada em aprovação há quanto tempo?" é a
-- pergunta que decide a cobrança do cliente, e a resposta não existia em lugar
-- nenhum: `jobs.status` é o estado atual e `updated_at` é a última edição de
-- qualquer campo, inclusive de uma vírgula na legenda.
--
-- `activity_logs` chega perto e não serve: ela grava "Moveu status para X",
-- mas o alvo é o **texto** `'Job: <título>'`, sem id. Ligar por título quebra
-- no dia em que alguém renomeia a peça — e quebra em silêncio, mostrando o
-- histórico de outra.
--
-- ---------------------------------------------------------------------
-- Quem escreve é o gatilho, nunca o app
-- ---------------------------------------------------------------------
--
-- É a mesma decisão de `jobs.updated_at`, e pelo mesmo motivo: o status é
-- mudado de muitos lugares — o seletor do card, o arrasto do quadro, a modal
-- de detalhe, as RPCs do portal (`portal_aprovar`, `portal_pedir_ajuste`) e o
-- cron de publicação, com a chave de serviço. Registrar a etapa em cada um
-- garantiria esquecer um, e esquecer aqui não quebra nada visível: a linha do
-- tempo fica com um buraco, e um buraco parece "ficou parado", que é
-- exatamente o contrário do que aconteceu.
--
-- ---------------------------------------------------------------------
-- Não há backfill, e isso é decisão
-- ---------------------------------------------------------------------
--
-- Seria fácil inserir uma linha por conteúdo existente com `created_at` e o
-- status atual. Seria mentira duas vezes: a peça não entrou na etapa de hoje
-- no dia em que foi criada, e a tela passaria a afirmar uma duração que
-- ninguém mediu — num número que a agência leva para a reunião com o cliente.
-- É a regra de `post_metrics`: nulo é "não medi", e "não medi" se diz.
--
-- O acervo começa sem histórico e a tela diz isso. Cada peça passa a ter o seu
-- na primeira vez que mudar de etapa.
--
-- Repetível, como toda migração do projeto: o banco é compartilhado entre as
-- duas máquinas e é produção.

create table if not exists public.historico_de_etapas (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references public.jobs(id) on delete cascade,
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    -- Sem `check` aqui de propósito: a lista fechada de status já tem um
    -- `check` em `jobs.status`, e um segundo faria a migração que acrescenta
    -- uma etapa precisar lembrar dos dois. Esta tabela é histórico — ela
    -- guarda o que **foi** verdade, inclusive um status que o produto venha a
    -- aposentar.
    status text not null,
    entrou_em timestamptz not null default now(),
    -- Nulo quando não houve sessão: o cron publicando, ou o cliente aprovando
    -- pelo portal, que é anônimo por definição.
    por_usuario uuid references auth.users(id) on delete set null,
    -- O nome no momento em que aconteceu. É histórico, então a cópia é certa
    -- aqui — diferente de `workspace_members.email`, que envelheceria: quem
    -- moveu a peça em março se chamava o que se chamava em março.
    por_nome text,
    -- De onde veio a mudança: 'equipe', 'portal' (o cliente aprovando, sem
    -- sessão) ou 'sistema' (o cron publicando, com a chave de serviço).
    --
    -- Sem esta coluna os três casos são indistinguíveis — todos chegam com
    -- `por_usuario` nulo —, e a tela teria de escolher entre calar sobre
    -- **quem** fez e inventar um autor. "Aprovado" sem dizer que foi o cliente
    -- é justamente a informação que faz a agência abrir o histórico.
    origem text not null default 'equipe'
);

alter table public.historico_de_etapas
    add column if not exists origem text not null default 'equipe';

comment on table public.historico_de_etapas is
    'Uma linha por entrada em etapa. Escrita só pelo gatilho; a duração é a diferença para a linha seguinte.';

create index if not exists historico_de_etapas_job_idx
    on public.historico_de_etapas (job_id, entrou_em);

alter table public.historico_de_etapas enable row level security;

drop policy if exists "membro le o historico da agencia" on public.historico_de_etapas;
create policy "membro le o historico da agencia"
    on public.historico_de_etapas for select
    to authenticated
    using (private.e_membro(workspace_id));

-- **Nenhuma política de escrita, e isso é o ponto.** Quem grava é o gatilho,
-- `security definer`. Uma política de insert aqui deixaria o navegador
-- afirmar que a peça ficou dois dias em produção quando ficou duas horas — e
-- esse número existe justamente para ser mostrado ao cliente. É a mesma razão
-- de `post_metrics` e `subscriptions` não terem escrita por sessão.

create or replace function private.registrar_etapa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_nome text;
    v_origem text;
begin
    -- No update, só interessa a troca de etapa. Sem esta guarda, cada edição
    -- de legenda viraria uma linha, e a duração de toda etapa seria zero.
    if tg_op = 'UPDATE' and new.status is not distinct from old.status then
        return new;
    end if;

    select m.name into v_nome
      from public.workspace_members m
     where m.user_id = (select auth.uid())
       and m.workspace_id = new.workspace_id;

    -- Os três casos chegam com `auth.uid()` nulo e **não** são a mesma coisa.
    -- O papel da sessão os separa: o cron fala com a chave de serviço, o
    -- portal do cliente é anônimo por definição. `auth.uid()` lê o JWT da
    -- sessão mesmo aqui dentro — ser `security definer` não troca a sessão.
    v_origem := case
        when (select auth.uid()) is not null then 'equipe'
        when (select auth.role()) = 'service_role' then 'sistema'
        else 'portal'
    end;

    insert into public.historico_de_etapas
        (job_id, workspace_id, status, por_usuario, por_nome, origem)
    values
        (new.id, new.workspace_id, new.status, (select auth.uid()), v_nome, v_origem);

    return new;
end;
$$;

drop trigger if exists jobs_registrar_etapa on public.jobs;

-- `after`, não `before`: a linha do histórico aponta para `jobs(id)` por chave
-- estrangeira, e num `before insert` a peça ainda não existe — o insert do
-- histórico falharia com 23503 e derrubaria a criação do conteúdo junto.
create trigger jobs_registrar_etapa
    after insert or update of status on public.jobs
    for each row
    execute function private.registrar_etapa();
