-- Catálogo de planos, por agência. Alinha a tela de Planos ao resto: antes
-- ela vivia num useState local e qualquer edição sumia no recarregamento.
create table if not exists public.plans (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    price numeric not null default 0,
    interval text not null default 'monthly' check (interval in ('monthly','yearly')),
    max_workspaces integer not null default 1,
    max_users integer not null default 3,
    storage text,
    features jsonb not null default '[]'::jsonb,
    badge text,
    active_agencies_count integer not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists plans_workspace_idx on public.plans (workspace_id);

alter table public.plans enable row level security;

-- Planos são configuração da própria plataforma: só o proprietário mexe.
drop policy if exists "membros leem planos" on public.plans;
create policy "membros leem planos"
    on public.plans for select
    to authenticated
    using ((select private.e_membro(workspace_id)));

drop policy if exists "dono gerencia planos" on public.plans;
create policy "dono gerencia planos"
    on public.plans for all
    to authenticated
    using ((select private.papel_na_agencia(workspace_id)) = 'owner')
    with check ((select private.papel_na_agencia(workspace_id)) = 'owner');
