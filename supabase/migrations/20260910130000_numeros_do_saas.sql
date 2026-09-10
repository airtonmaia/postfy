-- =====================================================================
-- Relatórios do produto: os números que o banco realmente sabe.
--
-- Do navegador esta tela é impossível de montar, e por um bom motivo: a RLS
-- recorta clientes, jobs e fila de publicação por agência, e quem administra
-- o produto não é membro das agências dos clientes. Contar do lado de cá
-- daria zero — ou, pior, alguém afrouxaria uma política para "resolver".
--
-- A função atravessa com `security definer`, e a primeira coisa que faz é
-- conferir `private.eh_admin_da_plataforma()`.
--
-- **Só devolve contagem.** Nenhum título de job, nome de cliente ou e-mail
-- sai daqui. É a diferença entre "o dono do SaaS sabe o tamanho da base" e "o
-- dono do SaaS lê o conteúdo das agências dos clientes" — a segunda coisa
-- nenhuma tela precisa, e ela quebraria a promessa que a RLS faz para cada
-- agência.
--
-- Existe porque o Financeiro já inventou número uma vez: MRR = agências ×
-- R$ 197, com transações de agências que nunca existiram. O conserto não é
-- calcular melhor, é só mostrar o que dá para contar.
-- =====================================================================

create or replace function public.admin_numeros_do_saas()
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

    select jsonb_build_object(
        'agencias', jsonb_build_object(
            'total', (select count(*) from public.workspaces),
            'em_teste', (select count(*) from public.workspaces where is_trial),
            'fora_do_teste', (select count(*) from public.workspaces where not is_trial),
            'com_dominio', (select count(*) from public.workspaces
                             where custom_domain is not null and custom_domain <> '')
        ),
        'usuarios', jsonb_build_object(
            'total', (select count(*) from auth.users),
            'confirmados', (select count(*) from auth.users where email_confirmed_at is not null),
            'ativos_30d', (select count(*) from auth.users
                            where last_sign_in_at > now() - interval '30 days'),
            -- Quem entrou e ficou sem agência é o sintoma do bug do convite,
            -- que já aconteceu: a pessoa cai numa agência vazia e conclui que
            -- o sistema não funciona.
            'sem_agencia', (select count(*) from auth.users u
                             where not exists (select 1 from public.workspace_members m
                                                where m.user_id = u.id)),
            'vinculos', (select count(*) from public.workspace_members),
            'convites_pendentes', (select count(*) from public.invites
                                    where accepted_at is null and expires_at > now())
        ),
        'conteudo', jsonb_build_object(
            'clientes', (select count(*) from public.clients),
            'jobs', (select count(*) from public.jobs),
            'jobs_30d', (select count(*) from public.jobs where created_at > now() - interval '30 days'),
            'leads', (select count(*) from public.leads),
            'contratos', (select count(*) from public.contracts)
        ),
        'jobs_por_status', coalesce((
            select jsonb_object_agg(status, quantidade)
            from (select status, count(*) as quantidade from public.jobs group by status) j
        ), '{}'::jsonb),
        'fila_de_publicacao', coalesce((
            select jsonb_object_agg(status, quantidade)
            from (select status, count(*) as quantidade from public.publish_queue group by status) p
        ), '{}'::jsonb),
        -- Doze meses fechados, do mais antigo para o mais novo. A série é
        -- montada a partir de `generate_series` e não dos dados: um mês sem
        -- nenhuma agência nova tem que aparecer com zero, senão o gráfico
        -- encurta o tempo e faz uma queda parecer um platô.
        'por_mes', coalesce((
            select jsonb_agg(jsonb_build_object(
                'mes', to_char(m.mes, 'YYYY-MM'),
                'agencias', (select count(*) from public.workspaces w
                              where date_trunc('month', w.created_at) = m.mes),
                'usuarios', (select count(*) from auth.users u
                              where date_trunc('month', u.created_at) = m.mes),
                'jobs', (select count(*) from public.jobs j
                          where date_trunc('month', j.created_at) = m.mes)
            ) order by m.mes)
            from generate_series(
                date_trunc('month', now()) - interval '11 months',
                date_trunc('month', now()),
                interval '1 month'
            ) as m(mes)
        ), '[]'::jsonb),
        'apurado_em', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')
    ) into resultado;

    return resultado;
end;
$$;

revoke all on function public.admin_numeros_do_saas() from public, anon;
grant execute on function public.admin_numeros_do_saas() to authenticated;
