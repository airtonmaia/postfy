-- =====================================================================
-- Orquesia: base multi-tenant
-- Uma agência = um workspace. Toda tabela de negócio é recortada por ele.
-- =====================================================================

-- Schema privado: helpers de RLS não podem ficar em public, onde qualquer
-- role recebe EXECUTE por padrão e a função vira endpoint público.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Agências
-- ---------------------------------------------------------------------
create table if not exists public.workspaces (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(trim(name)) between 1 and 120),
    slug text not null unique check (slug ~ '^[a-z0-9-]{1,60}$'),
    logo text,
    favicon text,
    primary_color text not null default '#6366f1',
    secondary_color text,
    custom_domain text,
    white_label boolean not null default false,
    timezone text not null default 'America/Sao_Paulo',
    is_trial boolean not null default true,
    trial_ends_at timestamptz,
    created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Vínculo usuário <-> agência. É esta tabela que sustenta todo o RLS.
-- ---------------------------------------------------------------------
create table if not exists public.workspace_members (
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null default 'owner' check (role in (
        'owner','admin','manager','social_media','designer','copywriter','financial','client'
    )),
    name text,
    avatar text,
    created_at timestamptz not null default now(),
    primary key (workspace_id, user_id)
);

-- Índice para a busca por usuário, que é o caminho quente do RLS.
create index if not exists workspace_members_user_idx
    on public.workspace_members (user_id);

-- ---------------------------------------------------------------------
-- Helpers de RLS
-- ---------------------------------------------------------------------
-- SECURITY DEFINER para ler workspace_members sem cair na RLS da própria
-- tabela (que se referenciaria em loop). search_path vazio obriga qualificar
-- tudo, fechando a porta para sequestro de search_path.

create or replace function private.workspace_ids_do_usuario()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
    select m.workspace_id
    from public.workspace_members m
    where m.user_id = (select auth.uid());
$$;

create or replace function private.e_membro(alvo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.workspace_members m
        where m.workspace_id = alvo
          and m.user_id = (select auth.uid())
    );
$$;

-- Papel do usuário corrente na agência, para as políticas de escrita.
create or replace function private.papel_na_agencia(alvo uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select m.role
    from public.workspace_members m
    where m.workspace_id = alvo
      and m.user_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- Agência: visível a quem é membro; alterável só por owner/admin.
drop policy if exists "membros leem a agencia" on public.workspaces;
create policy "membros leem a agencia"
    on public.workspaces for select
    to authenticated
    using ((select private.e_membro(id)));

drop policy if exists "donos editam a agencia" on public.workspaces;
create policy "donos editam a agencia"
    on public.workspaces for update
    to authenticated
    using ((select private.papel_na_agencia(id)) in ('owner','admin'))
    with check ((select private.papel_na_agencia(id)) in ('owner','admin'));

-- Criação da agência é feita por RPC (public.criar_agencia), não direto:
-- workspaces não tem política de INSERT de propósito.

-- Membros: cada um enxerga os colegas da própria agência.
drop policy if exists "membros veem a equipe" on public.workspace_members;
create policy "membros veem a equipe"
    on public.workspace_members for select
    to authenticated
    using ((select private.e_membro(workspace_id)));

drop policy if exists "membro edita o proprio perfil" on public.workspace_members;
create policy "membro edita o proprio perfil"
    on public.workspace_members for update
    to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

drop policy if exists "donos gerenciam a equipe" on public.workspace_members;
create policy "donos gerenciam a equipe"
    on public.workspace_members for delete
    to authenticated
    using (
        (select private.papel_na_agencia(workspace_id)) in ('owner','admin')
        and user_id <> (select auth.uid())
    );
