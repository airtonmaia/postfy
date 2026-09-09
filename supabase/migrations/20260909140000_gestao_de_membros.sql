-- =====================================================================
-- Gestão de membros: inativar, editar papel e remover.
--
-- A tela de Usuários só listava. Faltavam três coisas no banco para ela
-- poder fazer mais do que mostrar:
--
-- 1. Não havia como inativar ninguém — só remover, que apaga o vínculo e
--    perde o histórico de quem era o quê.
-- 2. A única política de UPDATE era `user_id = auth.uid()`, sem restrição
--    de coluna: qualquer membro podia rodar
--    `update workspace_members set role='owner' where user_id = auth.uid()`
--    e virar dono da agência. Auto-promoção em uma linha.
-- 3. Nada impedia um admin de rebaixar o dono, nem de a agência ficar sem
--    nenhum dono ativo.
--
-- A checagem fica em trigger, e não em WITH CHECK, porque WITH CHECK só
-- enxerga a linha nova: comparar com o papel anterior exige o OLD.
-- =====================================================================

alter table public.workspace_members
    add column if not exists ativo boolean not null default true;

-- ---------------------------------------------------------------------
-- Membro inativo perde o acesso.
--
-- Estes dois helpers são a base de toda a RLS do projeto: mudar aqui vale
-- por todas as tabelas de negócio de uma vez, sem tocar em cada política.
-- ---------------------------------------------------------------------
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
          and m.ativo
    );
$$;

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
      and m.user_id = (select auth.uid())
      and m.ativo;
$$;

-- ---------------------------------------------------------------------
-- Regras que a política não expressa.
-- ---------------------------------------------------------------------
create or replace function private.checar_edicao_de_membro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    ator uuid := (select auth.uid());
    papel_do_ator text;
    outros_donos integer;
begin
    -- Sem sessão é rotina de serviço (RPC de aceite de convite, migração):
    -- essas já validam por conta própria.
    if ator is null then
        return new;
    end if;

    select m.role into papel_do_ator
    from public.workspace_members m
    where m.workspace_id = new.workspace_id
      and m.user_id = ator
      and m.ativo;

    -- Fecha a auto-promoção: o papel e o acesso de alguém são sempre
    -- decisão de outra pessoa.
    if new.user_id = ator
       and (new.role is distinct from old.role or new.ativo is distinct from old.ativo) then
        raise exception 'Você não pode alterar o próprio papel nem o próprio acesso.'
            using errcode = '42501';
    end if;

    if old.role = 'owner' and coalesce(papel_do_ator, '') <> 'owner' then
        raise exception 'Só o proprietário pode alterar outro proprietário.'
            using errcode = '42501';
    end if;

    if new.role = 'owner' and old.role <> 'owner' and coalesce(papel_do_ator, '') <> 'owner' then
        raise exception 'Só o proprietário pode promover alguém a proprietário.'
            using errcode = '42501';
    end if;

    -- Uma agência sem dono ativo não tem quem gerencie plano, equipe nem
    -- exclusão: ninguém consegue desfazer o passo seguinte.
    if old.role = 'owner' and old.ativo
       and (new.role <> 'owner' or not new.ativo) then
        select count(*) into outros_donos
        from public.workspace_members m
        where m.workspace_id = old.workspace_id
          and m.role = 'owner'
          and m.ativo
          and m.user_id <> old.user_id;

        if outros_donos = 0 then
            raise exception 'A agência precisa de pelo menos um proprietário ativo.'
                using errcode = '42501';
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists membro_editado on public.workspace_members;
create trigger membro_editado
    before update on public.workspace_members
    for each row execute function private.checar_edicao_de_membro();

create or replace function private.checar_remocao_de_membro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    ator uuid := (select auth.uid());
    papel_do_ator text;
    outros_donos integer;
begin
    if ator is null then
        return old;
    end if;

    select m.role into papel_do_ator
    from public.workspace_members m
    where m.workspace_id = old.workspace_id
      and m.user_id = ator
      and m.ativo;

    if old.role = 'owner' and coalesce(papel_do_ator, '') <> 'owner' then
        raise exception 'Só o proprietário pode remover outro proprietário.'
            using errcode = '42501';
    end if;

    if old.role = 'owner' then
        select count(*) into outros_donos
        from public.workspace_members m
        where m.workspace_id = old.workspace_id
          and m.role = 'owner'
          and m.ativo
          and m.user_id <> old.user_id;

        if outros_donos = 0 then
            raise exception 'A agência precisa de pelo menos um proprietário ativo.'
                using errcode = '42501';
        end if;
    end if;

    return old;
end;
$$;

drop trigger if exists membro_removido on public.workspace_members;
create trigger membro_removido
    before delete on public.workspace_members
    for each row execute function private.checar_remocao_de_membro();

-- ---------------------------------------------------------------------
-- Políticas.
--
-- A de auto-edição continua existindo (nome e avatar), mas agora o papel e
-- o `ativo` estão protegidos pelo trigger acima.
-- ---------------------------------------------------------------------
drop policy if exists "donos editam a equipe" on public.workspace_members;
create policy "donos editam a equipe"
    on public.workspace_members
    for update
    using (
        (select private.papel_na_agencia(workspace_members.workspace_id))
            = any (array['owner', 'admin'])
    )
    with check (
        (select private.papel_na_agencia(workspace_members.workspace_id))
            = any (array['owner', 'admin'])
    );

-- Membro inativo não aparece como "equipe" para efeito de contagem, mas a
-- linha continua legível por quem administra — é assim que a tela oferece
-- reativar.
