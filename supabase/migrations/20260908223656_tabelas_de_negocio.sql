-- =====================================================================
-- Tabelas de negócio. Colunas escalares para o que é filtrado/ordenado,
-- jsonb para as estruturas aninhadas (contatos, versões, checklist...).
-- =====================================================================

create table if not exists public.clients (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    legal_name text,
    trade_name text,
    cpf_cnpj text,
    email text,
    phone text,
    avatar text,
    status text not null default 'active' check (status in ('active','inactive')),
    segment text,
    website text,
    internal_responsible_id text,
    health_score text not null default 'green' check (health_score in ('green','yellow','red')),
    notes text,
    portal_token text not null unique default encode(gen_random_bytes(24), 'hex'),
    services jsonb not null default '[]'::jsonb,
    contacts jsonb not null default '[]'::jsonb,
    briefing jsonb not null default '{}'::jsonb,
    passwords jsonb not null default '[]'::jsonb,
    invoices jsonb not null default '[]'::jsonb,
    files jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.jobs (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    client_id uuid not null references public.clients(id) on delete cascade,
    title text not null,
    description text,
    caption text,
    cta text,
    hashtags jsonb not null default '[]'::jsonb,
    platform text not null check (platform in ('instagram','facebook','linkedin','tiktok','youtube','twitter')),
    format text not null check (format in ('feed','carousel','reel','story','video','article')),
    status text not null check (status in ('ideas','in_production','for_approval','in_adjustment','approved','scheduled','published')),
    priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
    scheduled_date timestamptz,
    deadline_production timestamptz,
    deadline_approval timestamptz,
    media_urls jsonb not null default '[]'::jsonb,
    current_version integer not null default 1,
    versions jsonb not null default '[]'::jsonb,
    checklist jsonb not null default '[]'::jsonb,
    comments jsonb not null default '[]'::jsonb,
    designer_id text,
    copywriter_id text,
    social_media_id text,
    last_feedback text,
    timesheet_minutes integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.leads (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    company text,
    email text,
    phone text,
    source text,
    service_interest text,
    estimated_value numeric not null default 0,
    stage text not null default 'new_lead' check (stage in ('new_lead','meeting_scheduled','proposal_sent','negotiating','won','lost')),
    responsible_id text,
    notes text,
    created_at timestamptz not null default now()
);

create table if not exists public.proposals (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    lead_id uuid references public.leads(id) on delete set null,
    client_id uuid references public.clients(id) on delete set null,
    client_name text not null,
    title text not null,
    items jsonb not null default '[]'::jsonb,
    total_monthly_value numeric not null default 0,
    status text not null default 'draft' check (status in ('draft','sent','viewed','accepted','rejected')),
    valid_until date,
    accepted_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists public.contracts (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    client_id uuid references public.clients(id) on delete set null,
    client_name text not null,
    title text not null,
    monthly_value numeric not null default 0,
    start_date date,
    end_date date,
    status text not null default 'draft' check (status in ('draft','sent','signed','expired','cancelled')),
    signed_at timestamptz,
    signatory_name text,
    created_at timestamptz not null default now()
);

create table if not exists public.automations (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    title text not null,
    trigger text not null,
    action text not null,
    enabled boolean not null default true,
    last_run_at timestamptz,
    execution_count integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    title text not null,
    message text,
    type text not null check (type in ('approval','adjustment','publication','system','lead')),
    read boolean not null default false,
    link_context jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    user_name text not null,
    action text not null,
    target text,
    created_at timestamptz not null default now()
);

create table if not exists public.client_materials (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    client_id uuid not null references public.clients(id) on delete cascade,
    client_name text,
    title text not null,
    description text,
    notes text,
    category text,
    url text not null,
    thumbnail_url text,
    file_type text check (file_type in ('image','video','document')),
    size text,
    status text not null default 'recebido' check (status in ('recebido','in_review','utilized')),
    created_at timestamptz not null default now()
);

create table if not exists public.timesheet_logs (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    job_id uuid references public.jobs(id) on delete cascade,
    job_title text,
    client_id uuid references public.clients(id) on delete set null,
    client_name text,
    user_id text,
    user_name text,
    minutes integer not null default 0,
    notes text,
    created_at timestamptz not null default now()
);

create table if not exists public.squads (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    leader_id text,
    member_ids jsonb not null default '[]'::jsonb,
    client_ids jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
);

-- Índices: workspace_id entra em toda política de RLS e em todo filtro.
create index if not exists clients_workspace_idx on public.clients (workspace_id);
create index if not exists jobs_workspace_idx on public.jobs (workspace_id);
create index if not exists jobs_client_idx on public.jobs (client_id);
create index if not exists jobs_status_idx on public.jobs (workspace_id, status);
create index if not exists jobs_scheduled_idx on public.jobs (workspace_id, scheduled_date);
create index if not exists leads_workspace_idx on public.leads (workspace_id);
create index if not exists proposals_workspace_idx on public.proposals (workspace_id);
create index if not exists contracts_workspace_idx on public.contracts (workspace_id);
create index if not exists automations_workspace_idx on public.automations (workspace_id);
create index if not exists notifications_workspace_idx on public.notifications (workspace_id, read);
create index if not exists activity_logs_workspace_idx on public.activity_logs (workspace_id, created_at desc);
create index if not exists client_materials_workspace_idx on public.client_materials (workspace_id);
create index if not exists timesheet_logs_workspace_idx on public.timesheet_logs (workspace_id);
create index if not exists squads_workspace_idx on public.squads (workspace_id);
