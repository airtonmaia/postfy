-- =====================================================================
-- A ficha completa de uma agência, para o /admin.
--
-- A tela de Agências mostrava nome, slug, contagem e fuso. A pergunta que o
-- dono do produto faz olhando para ela é outra: *quem abriu isto, quando, de
-- onde, e o que essa pessoa fez depois?*
--
-- **Esta função devolve só o que o banco mede.** O que não está aqui não está
-- porque ninguém mediu, e a tela diz isso com todas as letras em vez de
-- desenhar um campo vazio com cara de dado faltando:
--
--   - **cidade/país do IP** — exige consultar um serviço de geolocalização
--     com o IP de uma pessoa. É dado pessoal indo para terceiro, e é decisão
--     de quem é dono do produto, não efeito colateral de abrir uma ficha.
--   - **tempo de sessão** — ninguém grava entrada e saída. `last_sign_in_at`
--     é um instante, não uma duração; somar "último acesso menos primeiro"
--     seria inventar um número que vai para uma decisão.
--   - **navegação** — que tela a pessoa abriu não é registrado em lugar
--     nenhum. `activity_logs` guarda **ações** ("Criou o conteúdo"), que é
--     outra coisa e é o que esta função devolve.
--
-- É a regra do `post_metrics` aplicada ao /admin: nulo é "não medi", e "não
-- medi" se diz.
--
-- ### De onde vem cada pedaço
--
--   workspaces              nome, slug, criação, fuso, domínio, trial
--   workspace_members       equipe, papel, quando entrou, ativo
--   auth.users              e-mail, nome, criação da conta, último acesso
--   auth.audit_log_entries  os acessos com **IP**, quando a tabela existir
--   activity_logs           o que cada um fez dentro da agência
--   clients/jobs/leads/…    o tamanho da base
--
-- `auth.audit_log_entries` é tratada como **opcional de propósito**: ela é
-- interna do Supabase, pode não estar legível num projeto e **é podada** — um
-- acesso antigo demais simplesmente não está lá. Sem ela, o resto da ficha
-- continua valendo; com um `select` direto, a função inteira falharia por
-- causa da parte menos importante dela.
-- =====================================================================

create or replace function public.admin_detalhes_da_agencia(p_workspace uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    ws        public.workspaces%rowtype;
    acessos   jsonb := '[]'::jsonb;
    tem_audit boolean;
begin
    if not private.eh_admin_da_plataforma() then
        raise exception 'Apenas administradores da plataforma.'
            using errcode = '42501';
    end if;

    select * into ws from public.workspaces w where w.id = p_workspace;
    if not found then
        return null;
    end if;

    -- A tabela de auditoria do Supabase pode não existir/estar legível. Sem
    -- ela a ficha perde o IP e mantém todo o resto.
    tem_audit := to_regclass('auth.audit_log_entries') is not null;

    if tem_audit then
        begin
            select coalesce(jsonb_agg(linha order by linha->>'quando' desc), '[]'::jsonb)
              into acessos
            from (
                select jsonb_build_object(
                    'quando',  a.created_at,
                    'acao',    a.payload->>'action',
                    'ip',      a.payload->>'ip_address',
                    'email',   a.payload->>'actor_username',
                    'user_id', a.payload->>'actor_id'
                ) as linha
                from auth.audit_log_entries a
                where a.payload->>'actor_id' in (
                    select m.user_id::text
                      from public.workspace_members m
                     where m.workspace_id = p_workspace
                )
                order by a.created_at desc
                limit 50
            ) t;
        exception when others then
            -- Sem permissão, sem coluna, sem tabela: a ficha segue sem o IP.
            acessos := '[]'::jsonb;
            tem_audit := false;
        end;
    end if;

    return jsonb_build_object(
        'agencia', jsonb_build_object(
            'id',             ws.id,
            'nome',           ws.name,
            'slug',           ws.slug,
            'criada_em',      ws.created_at,
            'timezone',       ws.timezone,
            'dominio',        ws.custom_domain,
            'white_label',    ws.white_label,
            'is_trial',       ws.is_trial,
            'trial_ends_at',  ws.trial_ends_at,
            'cor_primaria',   ws.primary_color,
            'excluida_em',    ws.deleted_at,
            /*
              Quem mandou para a lixeira é a **única** coluna de autoria que o
              schema já tinha, e ela vem resolvida em nome: um uuid na tela do
              dono do produto é um dado que ele teria de ir procurar em outro
              lugar para entender.
            */
            'excluida_por',   (
                select coalesce(u.raw_user_meta_data->>'name',
                                u.raw_user_meta_data->>'full_name',
                                u.email)
                from auth.users u where u.id = ws.deleted_by
            )
        ),

        /*
          **Quem criou é o dono mais antigo**, e não uma coluna `created_by`
          que não existe. `criar_agencia` faz de quem chama o `owner`, e o
          vínculo nasce no mesmo instante da agência — a diferença entre os
          dois `created_at` foi de 129 ms no caso que este projeto já
          investigou. Se a agência trocou de dono depois, o vínculo mais antigo
          continua sendo o de quem abriu.
        */
        'criador', (
            select jsonb_build_object(
                'user_id',       u.id,
                'nome',          coalesce(u.raw_user_meta_data->>'name',
                                          u.raw_user_meta_data->>'full_name',
                                          m.name),
                'email',         u.email,
                'papel_hoje',    m.role,
                'entrou_em',     m.created_at,
                'conta_criada',  u.created_at,
                'ultimo_acesso', u.last_sign_in_at
            )
            from public.workspace_members m
            join auth.users u on u.id = m.user_id
            where m.workspace_id = p_workspace
            order by m.created_at asc, m.role = 'owner' desc
            limit 1
        ),

        'equipe', coalesce((
            select jsonb_agg(jsonb_build_object(
                'user_id',       u.id,
                'nome',          coalesce(u.raw_user_meta_data->>'name',
                                          u.raw_user_meta_data->>'full_name',
                                          m.name),
                'email',         u.email,
                'papel',         m.role,
                'ativo',         m.ativo,
                'entrou_em',     m.created_at,
                'ultimo_acesso', u.last_sign_in_at
            ) order by m.created_at)
            from public.workspace_members m
            join auth.users u on u.id = m.user_id
            where m.workspace_id = p_workspace
        ), '[]'::jsonb),

        'base', jsonb_build_object(
            'clientes',  (select count(*) from public.clients          c where c.workspace_id = p_workspace),
            'jobs',      (select count(*) from public.jobs             j where j.workspace_id = p_workspace),
            'leads',     (select count(*) from public.leads            l where l.workspace_id = p_workspace),
            'propostas', (select count(*) from public.proposals        p where p.workspace_id = p_workspace),
            'contratos', (select count(*) from public.contracts        c where c.workspace_id = p_workspace),
            'materiais', (select count(*) from public.client_materials m where m.workspace_id = p_workspace),
            'conexoes',  (select count(*) from public.social_connections s where s.workspace_id = p_workspace)
        ),

        /*
          O trabalho tem data: a primeira e a última ação dizem se a agência
          está em uso ou se abriu e parou — que é a pergunta real por trás de
          "quanto tempo". Duração de sessão continua não sendo medida.
        */
        'atividade', jsonb_build_object(
            'total',     (select count(*) from public.activity_logs a where a.workspace_id = p_workspace),
            'primeira',  (select min(a.created_at) from public.activity_logs a where a.workspace_id = p_workspace),
            'ultima',    (select max(a.created_at) from public.activity_logs a where a.workspace_id = p_workspace),
            'recentes', coalesce((
                select jsonb_agg(linha order by linha->>'quando' desc)
                from (
                    select jsonb_build_object(
                        'quando',  a.created_at,
                        'acao',    a.action,
                        'alvo',    a.target,
                        'por',     a.user_name
                    ) as linha
                    from public.activity_logs a
                    where a.workspace_id = p_workspace
                    order by a.created_at desc
                    limit 30
                ) t
            ), '[]'::jsonb)
        ),

        'assinatura', (
            select jsonb_build_object(
                'status',           s.status,
                'plano',            s.plano,
                'preco_centavos',   s.preco_centavos,
                'moeda',            s.moeda,
                'periodo_fim',      s.periodo_fim,
                'cancelar_no_fim',  s.cancelar_no_fim,
                'criado_em',        s.criado_em
            )
            from public.subscriptions s
            where s.workspace_id = p_workspace
            limit 1
        ),

        'acessos', acessos,
        /*
          A tela precisa distinguir "nenhum acesso registrado" de "não dá para
          registrar acesso aqui". Sem esta bandeira, uma lista vazia diria com
          cara de certo que ninguém nunca entrou.
        */
        'acessos_disponiveis', tem_audit
    );
end;
$$;

revoke all on function public.admin_detalhes_da_agencia(uuid) from public, anon;
grant execute on function public.admin_detalhes_da_agencia(uuid) to authenticated;
