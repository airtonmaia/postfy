-- =====================================================================
-- Convites de equipe
-- =====================================================================

create table if not exists public.invites (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    email text not null,
    name text,
    role text not null check (role in (
        'admin','manager','social_media','designer','copywriter','financial','client'
    )),
    token text not null unique default encode(gen_random_bytes(24), 'hex'),
    created_by uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '7 days'),
    accepted_at timestamptz
);

create index if not exists invites_workspace_idx on public.invites (workspace_id);
create unique index if not exists invites_pendente_por_email
    on public.invites (workspace_id, lower(email))
    where accepted_at is null;

alter table public.invites enable row level security;

-- Só owner/admin da agência enxerga e administra os convites dela.
-- O token nunca é exposto por esta política: quem precisa dele é quem cria,
-- e a criação devolve o valor uma única vez pela RPC.
drop policy if exists "donos leem convites" on public.invites;
create policy "donos leem convites"
    on public.invites for select
    to authenticated
    using ((select private.papel_na_agencia(workspace_id)) in ('owner','admin'));

drop policy if exists "donos revogam convites" on public.invites;
create policy "donos revogam convites"
    on public.invites for delete
    to authenticated
    using ((select private.papel_na_agencia(workspace_id)) in ('owner','admin'));

-- Criação passa pela RPC, para o token ser devolvido só na resposta.
create or replace function public.criar_convite(
    agencia uuid,
    email_convidado text,
    papel text,
    nome_convidado text default null
)
returns public.invites
language plpgsql
security definer
set search_path = ''
as $$
declare
    quem uuid := (select auth.uid());
    novo public.invites;
begin
    if quem is null then
        raise exception 'Não autenticado' using errcode = '42501';
    end if;

    -- SECURITY DEFINER ignora RLS, então a permissão é conferida aqui.
    if (select private.papel_na_agencia(agencia)) not in ('owner','admin') then
        raise exception 'Apenas proprietário ou administrador pode convidar'
            using errcode = '42501';
    end if;

    if papel not in ('admin','manager','social_media','designer','copywriter','financial','client') then
        raise exception 'Papel inválido' using errcode = '22023';
    end if;

    -- Um convite pendente por e-mail e agência: o novo substitui o anterior.
    delete from public.invites
     where workspace_id = agencia
       and lower(email) = lower(trim(email_convidado))
       and accepted_at is null;

    insert into public.invites (workspace_id, email, name, role, created_by)
    values (agencia, lower(trim(email_convidado)), nullif(trim(coalesce(nome_convidado,'')), ''), papel, quem)
    returning * into novo;

    return novo;
end;
$$;

revoke execute on function public.criar_convite(uuid, text, text, text) from public, anon;
grant execute on function public.criar_convite(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Consulta pública do convite (tela de aceite, antes de existir sessão)
-- ---------------------------------------------------------------------
-- Devolve só o necessário para exibir o convite. Não expõe id, quem criou,
-- nem nada do restante da agência.
create or replace function public.convite_por_token(t text)
returns table (email text, name text, role text, agencia text)
language sql
stable
security definer
set search_path = ''
as $$
    select i.email, i.name, i.role, w.name
    from public.invites i
    join public.workspaces w on w.id = i.workspace_id
    where i.token = t
      and i.accepted_at is null
      and i.expires_at > now();
$$;

revoke execute on function public.convite_por_token(text) from public;
grant execute on function public.convite_por_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Aceite: liga o usuário já autenticado à agência do convite
-- ---------------------------------------------------------------------
create or replace function public.aceitar_convite(t text, nome_do_usuario text default null)
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
    quem uuid := (select auth.uid());
    email_da_sessao text;
    convite public.invites;
    agencia public.workspaces;
begin
    if quem is null then
        raise exception 'É preciso estar autenticado para aceitar o convite'
            using errcode = '42501';
    end if;

    select i.* into convite
      from public.invites i
     where i.token = t
       and i.accepted_at is null
       and i.expires_at > now();

    if convite.id is null then
        raise exception 'Convite inválido ou expirado' using errcode = '22023';
    end if;

    -- O convite vale para o e-mail convidado, não para quem tiver o link.
    select u.email into email_da_sessao from auth.users u where u.id = quem;
    if lower(email_da_sessao) <> lower(convite.email) then
        raise exception 'Este convite foi emitido para outro e-mail'
            using errcode = '42501';
    end if;

    insert into public.workspace_members (workspace_id, user_id, role, name)
    values (convite.workspace_id, quem, convite.role,
            nullif(trim(coalesce(nome_do_usuario,'')), ''))
    on conflict (workspace_id, user_id) do nothing;

    update public.invites set accepted_at = now() where id = convite.id;

    select * into agencia from public.workspaces where id = convite.workspace_id;
    return agencia;
end;
$$;

revoke execute on function public.aceitar_convite(text, text) from public, anon;
grant execute on function public.aceitar_convite(text, text) to authenticated;
