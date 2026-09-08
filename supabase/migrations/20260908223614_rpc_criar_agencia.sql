-- =====================================================================
-- Criação de agência no cadastro.
-- workspaces não tem política de INSERT: criar agência passa só por aqui,
-- de forma atômica (agência + vínculo de dono na mesma transação).
-- =====================================================================

-- Normalização de acentos sem depender da extensão unaccent.
create or replace function public.unaccent_simples(txt text)
returns text
language sql
immutable
set search_path = ''
as $$
    select translate(
        txt,
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
    );
$$;

create or replace function public.criar_agencia(
    nome text,
    nome_do_usuario text default null
)
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
    quem uuid := (select auth.uid());
    base_slug text;
    slug_final text;
    sufixo int := 0;
    nova public.workspaces;
begin
    -- SECURITY DEFINER ignora RLS, então a identidade é conferida aqui.
    if quem is null then
        raise exception 'É preciso estar autenticado para criar uma agência'
            using errcode = '42501';
    end if;

    if nome is null or length(trim(nome)) = 0 then
        raise exception 'Informe o nome da agência' using errcode = '22023';
    end if;

    -- Slug a partir do nome, sem acento e sem colisão.
    base_slug := regexp_replace(
        lower(public.unaccent_simples(trim(nome))),
        '[^a-z0-9]+', '-', 'g'
    );
    base_slug := trim(both '-' from base_slug);
    if length(base_slug) = 0 then
        base_slug := 'agencia';
    end if;
    base_slug := left(base_slug, 50);

    slug_final := base_slug;
    while exists (select 1 from public.workspaces w where w.slug = slug_final) loop
        sufixo := sufixo + 1;
        slug_final := left(base_slug, 50) || '-' || sufixo::text;
    end loop;

    insert into public.workspaces (name, slug)
    values (left(trim(nome), 120), slug_final)
    returning * into nova;

    insert into public.workspace_members (workspace_id, user_id, role, name)
    values (nova.id, quem, 'owner', nullif(trim(coalesce(nome_do_usuario, '')), ''));

    return nova;
end;
$$;

-- Só usuários autenticados criam agência.
revoke execute on function public.criar_agencia(text, text) from public, anon;
grant execute on function public.criar_agencia(text, text) to authenticated;

revoke execute on function public.unaccent_simples(text) from public, anon;
grant execute on function public.unaccent_simples(text) to authenticated;
