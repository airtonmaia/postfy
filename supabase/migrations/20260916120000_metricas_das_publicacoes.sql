-- Métricas reais do que foi publicado.
--
-- Relatórios media **produção** — quantas peças, prazos cumpridos — e nunca
-- resultado. É a diferença entre o que a agência faz e o que ela entrega, e é
-- o relatório que ela mostra ao cliente para justificar o contrato:
-- "publicamos 24 peças no prazo" não responde a pergunta que o cliente faz.
--
-- O dado vem da Meta, pelo token que já publica. Ele **não** pode ser lido do
-- navegador: `social_tokens` tem RLS ligada e zero políticas, e só a função
-- serverless a alcança. Por isso a métrica é gravada aqui pelo cron, com a
-- chave de serviço, e a tela lê desta tabela.

create table if not exists public.post_metrics (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    client_id uuid references public.clients(id) on delete set null,
    job_id uuid references public.jobs(id) on delete cascade,
    connection_id uuid not null references public.social_connections(id) on delete cascade,
    platform text not null,

    -- O id do post na rede. É por ele que a métrica é buscada de novo.
    external_id text not null,
    permalink text,
    publicado_em timestamptz,

    -- **Nulo é "não medi", zero é "medi e deu zero".** Os dois são verdade
    -- diferentes: alcance 0 num post de ontem é um problema de conteúdo;
    -- alcance nulo é a Meta não ter respondido, e a tela precisa dizer qual
    -- dos dois é. Por isso nenhuma coluna tem `default 0`.
    alcance integer,
    curtidas integer,
    comentarios integer,
    salvamentos integer,
    compartilhamentos integer,

    medido_em timestamptz not null default now(),
    ultimo_erro text,

    unique (connection_id, external_id)
);

create index if not exists post_metrics_workspace_idx
    on public.post_metrics (workspace_id, publicado_em desc);

-- Quem precisa ser remedido primeiro: o mais antigo de medição.
create index if not exists post_metrics_medido_idx
    on public.post_metrics (medido_em);

alter table public.post_metrics enable row level security;

-- Leitura para quem é da agência. **Nenhuma política de escrita para sessão
-- autenticada**, de propósito — mesma decisão de `subscriptions`: uma política
-- de update aqui deixaria o navegador afirmar o alcance que quisesse, e o
-- número existe justamente para ser mostrado ao cliente da agência.
drop policy if exists "membro le as metricas da agencia" on public.post_metrics;
create policy "membro le as metricas da agencia"
    on public.post_metrics for select
    to authenticated
    using (
        exists (
            select 1 from public.workspace_members m
             where m.workspace_id = post_metrics.workspace_id
               and m.user_id = auth.uid()
        )
    );
