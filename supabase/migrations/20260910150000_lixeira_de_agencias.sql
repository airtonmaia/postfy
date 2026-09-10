-- =====================================================================
-- Lixeira de agências: 7 dias antes da exclusão de verdade.
--
-- Antes, o botão "Excluir Agência" em Admin → Agências chamava a mesma
-- função que "sair da agência": removia o vínculo de quem clicou, não a
-- agência. Para o admin da plataforma, que normalmente não é membro
-- daquela agência, isso era um no-op silencioso — o botão não fazia nada, e
-- ninguém via erro.
--
-- Agora existe de verdade, em duas etapas. `deleted_at` marca a entrada na
-- lixeira; a linha continua no banco, legível, restaurável. Sete dias
-- depois, `api/expurgar-lixeira.ts` apaga os arquivos no R2 e a linha no
-- banco — que leva junto, por `on delete cascade`, as 16 tabelas que
-- referenciam `workspace_id`.
-- =====================================================================

alter table public.workspaces
    add column if not exists deleted_at timestamptz,
    add column if not exists deleted_by uuid references auth.users(id) on delete set null;

-- O expurgo diário consulta exatamente "quem está na lixeira", e são poucas
-- linhas comparado ao total de agências — índice parcial, não sobre a
-- imensa maioria que nunca entra ali.
create index if not exists workspaces_deleted_at_idx
    on public.workspaces (deleted_at)
    where deleted_at is not null;

-- ---------------------------------------------------------------------
-- Mover para a lixeira e restaurar, por RPC.
--
-- Um `update` direto passaria pela política "donos editam a agencia", que
-- cobre owner/admin da própria agência — mas não cobre o admin da
-- plataforma, que normalmente **não é membro** da agência que está
-- gerenciando. Foi esse descasamento que deixou o botão antigo mudo. A RPC
-- resolve isso conferindo os dois papéis, com `security definer`.
-- ---------------------------------------------------------------------

create or replace function public.mover_agencia_para_lixeira(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    ator uuid := (select auth.uid());
    papel text;
    linha public.workspaces;
begin
    if ator is null then
        raise exception 'Sessão inválida.' using errcode = '42501';
    end if;

    select m.role into papel
    from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = ator;

    if coalesce(papel, '') not in ('owner', 'admin') and not private.eh_admin_da_plataforma() then
        raise exception 'Só o proprietário, um administrador da agência ou o administrador da plataforma pode excluir.'
            using errcode = '42501';
    end if;

    -- Idempotente: clicar duas vezes não reinicia a contagem dos 7 dias.
    update public.workspaces
       set deleted_at = coalesce(deleted_at, now()),
           deleted_by = coalesce(deleted_by, ator)
     where id = p_workspace_id
     returning * into linha;

    if not found then
        raise exception 'Agência não encontrada.' using errcode = 'P0002';
    end if;

    return jsonb_build_object('deleted_at', linha.deleted_at, 'deleted_by', linha.deleted_by);
end;
$$;

revoke all on function public.mover_agencia_para_lixeira(uuid) from public, anon;
grant execute on function public.mover_agencia_para_lixeira(uuid) to authenticated;

create or replace function public.restaurar_agencia(p_workspace_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    ator uuid := (select auth.uid());
    papel text;
    linhas_afetadas int;
begin
    if ator is null then
        raise exception 'Sessão inválida.' using errcode = '42501';
    end if;

    select m.role into papel
    from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = ator;

    if coalesce(papel, '') not in ('owner', 'admin') and not private.eh_admin_da_plataforma() then
        raise exception 'Só o proprietário, um administrador da agência ou o administrador da plataforma pode restaurar.'
            using errcode = '42501';
    end if;

    update public.workspaces
       set deleted_at = null, deleted_by = null
     where id = p_workspace_id and deleted_at is not null;

    get diagnostics linhas_afetadas = row_count;

    -- false e não exceção: pedir para restaurar algo que já não está na
    -- lixeira (porque nunca esteve, ou porque o expurgo já passou) é uma
    -- pergunta com resposta "não", não um erro de permissão.
    return linhas_afetadas > 0;
end;
$$;

revoke all on function public.restaurar_agencia(uuid) from public, anon;
grant execute on function public.restaurar_agencia(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Sem política de DELETE em `workspaces`, de propósito.
--
-- A exclusão de verdade só acontece por `api/expurgar-lixeira.ts` e
-- `api/excluir-agencia.ts`, os dois com a chave de serviço — nunca por uma
-- sessão autenticada. Uma política de DELETE aqui abriria um segundo
-- caminho para apagar uma agência sem passar pelos 7 dias.
-- ---------------------------------------------------------------------
