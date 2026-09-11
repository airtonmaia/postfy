-- =====================================================================
-- Quantas pessoas, clientes e conteúdos cada agência tem.
--
-- A tela Admin → Agências mostrava "3 usuários" para toda agência em que o
-- número real não aparecia — literal no código, como fallback. Era a
-- armadilha 9 na mesma tela que decide o que fazer com a agência.
--
-- Contar do navegador não resolve: a RLS de `workspace_members`, `clients` e
-- `jobs` recorta por agência, e quem administra o produto **não é membro**
-- das agências dos clientes. A contagem daria zero — que seria outra
-- mentira, só que para baixo.
--
-- Mesmo desenho de `admin_numeros_do_saas`: devolve só contagem, nenhum
-- nome, título ou e-mail. O dono do SaaS sabe o tamanho de cada agência sem
-- ler o conteúdo dela.
-- =====================================================================

create or replace function public.admin_contagens_por_agencia()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if not private.eh_admin_da_plataforma() then
        raise exception 'Apenas administradores da plataforma.'
            using errcode = '42501';
    end if;

    return coalesce((
        select jsonb_object_agg(w.id::text, jsonb_build_object(
            'membros',  (select count(*) from public.workspace_members m where m.workspace_id = w.id),
            'clientes', (select count(*) from public.clients c        where c.workspace_id = w.id),
            'jobs',     (select count(*) from public.jobs j           where j.workspace_id = w.id)
        ))
        from public.workspaces w
    ), '{}'::jsonb);
end;
$$;

revoke all on function public.admin_contagens_por_agencia() from public, anon;
grant execute on function public.admin_contagens_por_agencia() to authenticated;
