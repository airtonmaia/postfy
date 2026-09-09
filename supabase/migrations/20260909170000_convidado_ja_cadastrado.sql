-- =====================================================================
-- Convite para quem já tem conta.
--
-- A tela tratava todo mundo como visitante novo: gerava link, mostrava o
-- link e pedia para compartilhar. Para quem já usa a plataforma isso é um
-- passo a mais sem função — a pessoa já tem senha, só falta aceitar o cargo.
--
-- Duas coisas aqui:
--
-- 1. `situacao_do_convidado` responde o que a tela precisa saber antes de
--    enviar: a pessoa tem conta? já está nesta agência? já há convite
--    pendente?
-- 2. `criar_convite` passa a recusar convite para quem já é membro. A regra
--    tem que morar no banco: só escondê-la na interface deixaria a API
--    aceitando o que a tela não deixa fazer.
--
-- A função conta se um e-mail tem conta, o que é informação sensível — por
-- isso ela exige ser owner/admin **da agência em questão**, e não só uma
-- sessão autenticada qualquer. Quem já pode convidar para aquela agência é
-- quem já receberia essa resposta de qualquer jeito, ao tentar convidar.
-- =====================================================================

create or replace function public.situacao_do_convidado(agencia uuid, email_convidado text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    alvo text := lower(trim(coalesce(email_convidado, '')));
    conta uuid;
begin
    if (select private.papel_na_agencia(agencia)) not in ('owner', 'admin') then
        raise exception 'Apenas proprietário ou administrador pode convidar'
            using errcode = '42501';
    end if;

    if alvo = '' or position('@' in alvo) = 0 then
        return jsonb_build_object(
            'tem_conta', false, 'ja_e_membro', false, 'convite_pendente', false
        );
    end if;

    select u.id into conta
    from auth.users u
    where lower(u.email) = alvo
    limit 1;

    return jsonb_build_object(
        'tem_conta', conta is not null,
        'ja_e_membro', conta is not null and exists (
            select 1
            from public.workspace_members m
            where m.workspace_id = agencia
              and m.user_id = conta
        ),
        'convite_pendente', exists (
            select 1
            from public.invites i
            where i.workspace_id = agencia
              and lower(i.email) = alvo
              and i.accepted_at is null
              and i.expires_at > now()
        )
    );
end;
$$;

revoke all on function public.situacao_do_convidado(uuid, text) from public, anon;
grant execute on function public.situacao_do_convidado(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Convite para quem já é membro não faz sentido: o aceite criaria um
-- vínculo que já existe, e o convite ficaria pendente para sempre.
-- ---------------------------------------------------------------------
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

    if exists (
        select 1
        from public.workspace_members m
        join auth.users u on u.id = m.user_id
        where m.workspace_id = agencia
          and lower(u.email) = lower(trim(email_convidado))
    ) then
        raise exception 'Esta pessoa já faz parte da agência.' using errcode = '23505';
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
