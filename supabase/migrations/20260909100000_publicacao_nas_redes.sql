-- ---------------------------------------------------------------------
-- Publicação automática nas redes sociais
--
-- Duas tabelas para a conexão, de propósito.
--
-- `social_connections` guarda o que a interface precisa mostrar: qual rede,
-- qual conta, desde quando, se expirou. É legível por qualquer membro da
-- agência.
--
-- `social_tokens` guarda o token de acesso, e **não tem política de RLS
-- nenhuma** — nem de leitura. Com RLS ligada e zero políticas, ninguém
-- autenticado alcança a tabela pela API: só a função serverless, com a chave
-- de serviço, que nunca vai para o navegador.
--
-- Se o token morasse junto do resto, qualquer membro da agência poderia
-- lê-lo pelo PostgREST e publicar fora do sistema, em nome do cliente, sem
-- deixar rastro aqui. Separar as duas coisas é o que impede isso.
-- ---------------------------------------------------------------------

create table if not exists public.social_connections (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    client_id uuid references public.clients(id) on delete cascade,
    platform text not null check (platform in ('instagram', 'facebook')),
    -- Id da conta na rede. Não é segredo: aparece na URL do perfil.
    account_id text not null,
    account_name text not null,
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id) on delete set null,
    unique (workspace_id, platform, account_id)
);

alter table public.social_connections enable row level security;

drop policy if exists "membro le as conexoes da agencia" on public.social_connections;
create policy "membro le as conexoes da agencia"
    on public.social_connections for select
    using (private.e_membro(workspace_id));

-- Conectar e desconectar passam pela função serverless, que é quem fala com
-- a rede social. Não há INSERT nem UPDATE aqui: uma linha criada à mão ficaria
-- sem token correspondente e a publicação falharia sem explicação.
drop policy if exists "gestor remove conexao" on public.social_connections;
create policy "gestor remove conexao"
    on public.social_connections for delete
    using (private.papel_na_agencia(workspace_id) in ('owner', 'admin', 'manager'));

-- ---------------------------------------------------------------------
-- Tokens: RLS ligada, nenhuma política. Inalcançável pela API pública.
-- ---------------------------------------------------------------------
create table if not exists public.social_tokens (
    connection_id uuid primary key
        references public.social_connections(id) on delete cascade,
    access_token text not null,
    refresh_token text,
    updated_at timestamptz not null default now()
);

alter table public.social_tokens enable row level security;

-- ---------------------------------------------------------------------
-- Fila de publicação
--
-- O agendamento já existia como uma data no conteúdo, mas nada lia essa data.
-- A fila torna o disparo observável: dá para ver o que está pendente, o que
-- falhou e por quê, e repetir sem duplicar — que é o mínimo para algo que
-- roda sozinho enquanto ninguém olha.
-- ---------------------------------------------------------------------
create table if not exists public.publish_queue (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    job_id uuid not null references public.jobs(id) on delete cascade,
    connection_id uuid not null references public.social_connections(id) on delete cascade,
    scheduled_for timestamptz not null,
    status text not null default 'pendente'
        check (status in ('pendente', 'publicando', 'publicado', 'falhou', 'cancelado')),
    attempts integer not null default 0,
    last_error text,
    external_id text,
    published_at timestamptz,
    created_at timestamptz not null default now(),
    -- Um conteúdo só entra na fila uma vez por conta conectada: sem isto, um
    -- clique duplicado no botão publicaria duas vezes no perfil do cliente.
    unique (job_id, connection_id)
);

alter table public.publish_queue enable row level security;

drop policy if exists "membro le a fila da agencia" on public.publish_queue;
create policy "membro le a fila da agencia"
    on public.publish_queue for select
    using (private.e_membro(workspace_id));

drop policy if exists "gestor agenda publicacao" on public.publish_queue;
create policy "gestor agenda publicacao"
    on public.publish_queue for insert
    with check (private.papel_na_agencia(workspace_id) in ('owner', 'admin', 'manager', 'social_media'));

drop policy if exists "gestor cancela publicacao" on public.publish_queue;
create policy "gestor cancela publicacao"
    on public.publish_queue for delete
    using (private.papel_na_agencia(workspace_id) in ('owner', 'admin', 'manager', 'social_media'));

-- O worker consulta por hora e estado; o índice parcial cobre exatamente
-- essa consulta e ignora o histórico, que é o que vai crescer.
create index if not exists publish_queue_pendentes_idx
    on public.publish_queue (scheduled_for)
    where status = 'pendente';
