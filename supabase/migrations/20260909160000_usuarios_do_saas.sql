-- =====================================================================
-- Super Admin: lista de todos os usuários e seus vínculos.
--
-- Não dava para montar esta tela do navegador. Duas paredes:
--
-- 1. `auth.users` não é exposta ao PostgREST — o e-mail de ninguém chega ao
--    cliente por consulta direta, e é assim que tem que ser.
-- 2. A política de SELECT de `workspace_members` é `private.e_membro`: quem
--    administra o produto não é membro das agências dos clientes, então
--    enxergaria zero linhas.
--
-- A RPC atravessa as duas com `security definer`, e a primeira coisa que ela
-- faz é conferir `private.eh_admin_da_plataforma()`. Sem essa checagem, uma
-- função assim seria um vazamento da base inteira de e-mails.
--
-- Papel na agência ≠ administrador da plataforma: quem manda aqui é
-- `platform_admins`, não o papel `owner` (que a RPC `criar_agencia` dá a todo
-- mundo que se cadastra).
-- =====================================================================

create or replace function public.admin_usuarios_do_saas()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    resultado jsonb;
begin
    if not private.eh_admin_da_plataforma() then
        raise exception 'Apenas administradores da plataforma.'
            using errcode = '42501';
    end if;

    select coalesce(jsonb_agg(linha order by linha->>'criado_em' desc), '[]'::jsonb)
      into resultado
    from (
        select jsonb_build_object(
            'user_id', u.id,
            'email', u.email,
            'nome', coalesce(
                u.raw_user_meta_data->>'name',
                u.raw_user_meta_data->>'full_name',
                -- O nome do vínculo é o que a agência cadastrou; serve de
                -- reserva quando a pessoa nunca preencheu o próprio perfil.
                (select m.name from public.workspace_members m
                  where m.user_id = u.id and m.name is not null limit 1)
            ),
            'criado_em', u.created_at,
            'ultimo_acesso', u.last_sign_in_at,
            'email_confirmado', (u.email_confirmed_at is not null),
            'agencias', coalesce((
                select jsonb_agg(
                    jsonb_build_object(
                        'workspace_id', w.id,
                        'nome', w.name,
                        'papel', m.role,
                        'ativo', m.ativo
                    )
                    order by w.name
                )
                from public.workspace_members m
                join public.workspaces w on w.id = m.workspace_id
                where m.user_id = u.id
            ), '[]'::jsonb),
            'admin_da_plataforma', exists (
                select 1 from public.platform_admins pa where pa.user_id = u.id
            )
        ) as linha
        from auth.users u
    ) as usuarios;

    return resultado;
end;
$$;

revoke all on function public.admin_usuarios_do_saas() from public, anon;
grant execute on function public.admin_usuarios_do_saas() to authenticated;
