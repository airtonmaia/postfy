-- =====================================================================
-- Usuários do cliente: aprovador e editor.
--
-- Até aqui, quem entrava no Portal do Cliente entrava como "o cliente" — o
-- token era da linha de `clients`, não de uma pessoa. Consequência: qualquer
-- e-mail cadastrado (o do cliente ou o de qualquer contato) abria o cofre de
-- senhas, as notas fiscais e o briefing. Não havia como dar acesso só de
-- aprovação a alguém.
--
-- E não bastava esconder aba na tela: `portal_dados` devolvia
-- `to_jsonb(cliente)` — a linha inteira, com `passwords` e `invoices`
-- dentro. Os dados já estavam no navegador antes de a tela decidir o que
-- mostrar. Por isso o recorte é aqui, no que a função devolve.
--
-- Dois papéis:
--
--   aprovador  vê e aprova conteúdo, e nada além disso
--   editor     tudo do aprovador + arquivos, senhas, notas, briefing
--              (inclusive alterar) e criar outros usuários
-- =====================================================================

create table if not exists public.client_users (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    client_id uuid not null references public.clients(id) on delete cascade,
    email text not null,
    name text,
    role text not null default 'aprovador' check (role in ('aprovador', 'editor')),
    ativo boolean not null default true,
    created_at timestamptz not null default now(),
    -- Quem criou. Uma das duas, nunca as duas: pela agência (auth.users) ou
    -- por um editor de dentro do portal (client_users). Saber a diferença
    -- importa no dia em que alguém perguntar "quem deu acesso a essa pessoa?".
    criado_por_membro uuid references auth.users(id) on delete set null,
    criado_por_cliente uuid references public.client_users(id) on delete set null,
    ultimo_acesso timestamptz
);

-- Um e-mail por cliente. O mesmo e-mail pode ser usuário de dois clientes
-- diferentes (agência de marketing que atende duas empresas do mesmo dono),
-- e isso é legítimo — por isso a unicidade é por cliente, não global.
create unique index if not exists client_users_email_idx
    on public.client_users (client_id, lower(email));

create index if not exists client_users_client_idx
    on public.client_users (client_id) where ativo;

-- Busca por e-mail no login do portal, que não sabe o cliente ainda.
create index if not exists client_users_email_busca_idx
    on public.client_users (lower(email)) where ativo;

alter table public.client_users enable row level security;

-- A agência enxerga e gerencia os usuários dos clientes dela.
drop policy if exists "membro le os usuarios do cliente" on public.client_users;
create policy "membro le os usuarios do cliente"
    on public.client_users for select
    to authenticated
    using ((select private.e_membro(workspace_id)));

drop policy if exists "gestor cria usuario do cliente" on public.client_users;
create policy "gestor cria usuario do cliente"
    on public.client_users for insert
    to authenticated
    with check (
        (select private.papel_na_agencia(workspace_id)) in ('owner', 'admin', 'manager')
    );

drop policy if exists "gestor edita usuario do cliente" on public.client_users;
create policy "gestor edita usuario do cliente"
    on public.client_users for update
    to authenticated
    using ((select private.papel_na_agencia(workspace_id)) in ('owner', 'admin', 'manager'))
    with check ((select private.papel_na_agencia(workspace_id)) in ('owner', 'admin', 'manager'));

drop policy if exists "gestor remove usuario do cliente" on public.client_users;
create policy "gestor remove usuario do cliente"
    on public.client_users for delete
    to authenticated
    using ((select private.papel_na_agencia(workspace_id)) in ('owner', 'admin', 'manager'));

-- ---------------------------------------------------------------------
-- Ninguém perde o acesso que já tinha.
--
-- Antes desta migração, entrava no portal quem estivesse em `clients.email`
-- ou em `clients.contacts[].email`. Todos entram como **editor**: era isso
-- que eles já podiam fazer, e rebaixá-los a aprovador tiraria capacidade sem
-- ninguém pedir. Quem quiser restringir agora tem a tela para isso.
-- ---------------------------------------------------------------------
insert into public.client_users (workspace_id, client_id, email, name, role)
select c.workspace_id, c.id, lower(trim(c.email)), c.name, 'editor'
from public.clients c
where coalesce(trim(c.email), '') <> ''
  and position('@' in c.email) > 0
on conflict (client_id, lower(email)) do nothing;

insert into public.client_users (workspace_id, client_id, email, name, role)
select
    c.workspace_id,
    c.id,
    lower(trim(contato->>'email')),
    nullif(trim(coalesce(contato->>'name', '')), ''),
    'editor'
from public.clients c,
     lateral jsonb_array_elements(coalesce(c.contacts, '[]'::jsonb)) as contato
where coalesce(trim(contato->>'email'), '') <> ''
  and position('@' in (contato->>'email')) > 0
on conflict (client_id, lower(email)) do nothing;

-- ---------------------------------------------------------------------
-- Sessões do portal.
--
-- O token deixa de ser o da linha de `clients` e passa a ser de uma sessão,
-- ligada à **pessoa** que entrou. Sem isso não há como o portal saber quem
-- está do outro lado, e portanto não há papel que valha.
--
-- RLS ligada e ZERO políticas, como `portal_codigos` e `social_tokens`:
-- inalcançável por qualquer sessão. Quem lê é função `security definer`.
-- ---------------------------------------------------------------------
create table if not exists public.portal_sessoes (
    token text primary key,
    client_user_id uuid not null references public.client_users(id) on delete cascade,
    expira_em timestamptz not null,
    created_at timestamptz not null default now()
);

alter table public.portal_sessoes enable row level security;

create index if not exists portal_sessoes_expira_idx on public.portal_sessoes (expira_em);

-- ---------------------------------------------------------------------
-- Quem está do outro lado do token.
-- ---------------------------------------------------------------------
create or replace function private.portal_usuario(p_token text)
returns public.client_users
language sql
stable
security definer
set search_path = ''
as $$
    select u.*
    from public.portal_sessoes s
    join public.client_users u on u.id = s.client_user_id
    where s.token = p_token
      and s.expira_em > now()
      and u.ativo
    limit 1;
$$;

-- ---------------------------------------------------------------------
-- Emitir código: procura em `client_users`, não mais em clients/contacts.
-- ---------------------------------------------------------------------
create or replace function public.portal_emitir_codigo(p_email text, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    alvo text := lower(trim(coalesce(p_email, '')));
    usuario public.client_users;
    cliente public.clients;
begin
    if alvo = '' or position('@' in alvo) = 0 then
        return null;
    end if;

    select u.* into usuario
    from public.client_users u
    join public.clients c on c.id = u.client_id
    where lower(u.email) = alvo
      and u.ativo
      and c.status = 'active'
    order by u.created_at
    limit 1;

    if usuario.id is null then
        return null;
    end if;

    select * into cliente from public.clients where id = usuario.client_id;

    -- Um código de cada vez por e-mail: pedir de novo invalida o anterior,
    -- senão cada pedido aumentaria a quantidade de códigos válidos.
    update public.portal_codigos
       set usado_em = now()
     where lower(email) = alvo
       and usado_em is null;

    insert into public.portal_codigos (client_id, email, codigo_hash, expira_em)
    values (
        cliente.id,
        alvo,
        encode(extensions.digest(p_codigo, 'sha256'), 'hex'),
        now() + interval '10 minutes'
    );

    return jsonb_build_object(
        'client_id', cliente.id,
        'nome', cliente.name,
        'workspace_id', cliente.workspace_id,
        'nome_agencia', (
            select w.name from public.workspaces w where w.id = cliente.workspace_id
        )
    );
end;
$$;

-- ---------------------------------------------------------------------
-- Conferir o código: abre uma sessão para a pessoa, e devolve o token dela.
-- ---------------------------------------------------------------------
create or replace function public.portal_conferir_codigo(p_email text, p_codigo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    registro public.portal_codigos;
    usuario public.client_users;
    novo_token text;
begin
    select * into registro
    from public.portal_codigos
    where lower(email) = lower(trim(coalesce(p_email, '')))
      and usado_em is null
      and expira_em > now()
    order by created_at desc
    limit 1;

    if not found then
        return null;
    end if;

    if registro.tentativas >= 5 then
        update public.portal_codigos set usado_em = now() where id = registro.id;
        return null;
    end if;

    if registro.codigo_hash <> encode(extensions.digest(coalesce(p_codigo, ''), 'sha256'), 'hex') then
        update public.portal_codigos
           set tentativas = tentativas + 1
         where id = registro.id;
        return null;
    end if;

    update public.portal_codigos set usado_em = now() where id = registro.id;

    select u.* into usuario
    from public.client_users u
    where u.client_id = registro.client_id
      and lower(u.email) = lower(registro.email)
      and u.ativo
    limit 1;

    if usuario.id is null then
        return null;
    end if;

    -- 32 bytes de fonte criptográfica: o token é a credencial da sessão, e
    -- viaja no sessionStorage do navegador de quem entrou.
    novo_token := encode(extensions.gen_random_bytes(32), 'hex');

    -- Sessão de 30 dias. O portal é usado em rajadas — o cliente entra para
    -- aprovar a leva da semana e some. Pedir código a cada visita cansaria
    -- exatamente quem a agência precisa que responda rápido.
    insert into public.portal_sessoes (token, client_user_id, expira_em)
    values (novo_token, usuario.id, now() + interval '30 days');

    update public.client_users set ultimo_acesso = now() where id = usuario.id;

    -- Sessões vencidas não servem para nada e a tabela só cresce.
    delete from public.portal_sessoes where expira_em < now() - interval '7 days';

    return novo_token;
end;
$$;

-- ---------------------------------------------------------------------
-- Dados do portal, recortados pelo papel.
--
-- O aprovador não recebe `passwords`, `invoices` nem `briefing` — e não é
-- questão de a tela escondê-los: eles não saem daqui. Uma aba escondida com
-- o dado já no navegador é uma tela mentindo sobre o que entregou.
-- ---------------------------------------------------------------------
create or replace function public.portal_dados(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    usuario public.client_users;
    cliente public.clients;
    cliente_json jsonb;
begin
    usuario := private.portal_usuario(p_token);
    if usuario.id is null then
        return null;
    end if;

    select * into cliente from public.clients where id = usuario.client_id;
    if cliente.id is null then
        return null;
    end if;

    cliente_json := to_jsonb(cliente);

    -- `portal_token` nunca precisou sair daqui: é credencial, e a sessão já
    -- é a credencial de quem está lendo.
    cliente_json := cliente_json - 'portal_token';

    if usuario.role <> 'editor' then
        cliente_json := cliente_json - 'passwords' - 'invoices' - 'briefing' - 'files';
    end if;

    return jsonb_build_object(
        'usuario', jsonb_build_object(
            'id', usuario.id,
            'nome', usuario.name,
            'email', usuario.email,
            'papel', usuario.role
        ),
        'cliente', cliente_json,
        'workspace', (
            select jsonb_build_object(
                'id', w.id,
                'name', w.name,
                'slug', w.slug,
                'logo', w.logo,
                'favicon', w.favicon,
                'primary_color', w.primary_color,
                'secondary_color', w.secondary_color,
                'white_label', w.white_label,
                'timezone', w.timezone
            )
            from public.workspaces w
            where w.id = cliente.workspace_id
        ),
        'jobs', coalesce((
            select jsonb_agg(to_jsonb(j) order by j.scheduled_date)
            from public.jobs j
            where j.client_id = cliente.id
        ), '[]'::jsonb),
        'materiais', case
            when usuario.role = 'editor' then coalesce((
                select jsonb_agg(to_jsonb(m) order by m.created_at desc)
                from public.client_materials m
                where m.client_id = cliente.id
            ), '[]'::jsonb)
            else '[]'::jsonb
        end
    );
end;
$$;

-- ---------------------------------------------------------------------
-- As funções por token passam a resolver pela sessão.
--
-- O corpo é o mesmo de antes — mexer em `versions`, `current_version`,
-- `last_feedback` e nos `link_context` das notificações é lógica testada, e
-- reescrevê-la aqui só criaria oportunidade de errar coluna. O que muda é
-- de onde vem o cliente, e quem é "quem": antes o log dizia "Cliente", agora
-- diz o nome da pessoa que apertou o botão.
--
-- Aprovar e pedir ajuste valem para os dois papéis: é o que o aprovador
-- existe para fazer.
-- ---------------------------------------------------------------------
create or replace function public.portal_aprovar(p_token text, p_job_id uuid, p_quem text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    usuario public.client_users;
    cliente public.clients;
    job public.jobs;
    quem text;
begin
    usuario := private.portal_usuario(p_token);
    if usuario.id is null then
        return false;
    end if;

    quem := coalesce(nullif(trim(p_quem), ''), usuario.name, usuario.email);

    select * into cliente from public.clients where id = usuario.client_id;
    if cliente.id is null then
        return false;
    end if;

    -- O job precisa ser do cliente da sessão. Sem isto, um token válido
    -- aprovaria o conteúdo de qualquer agência.
    select * into job from public.jobs where id = p_job_id and client_id = cliente.id;
    if not found then
        return false;
    end if;

    update public.jobs
       set status = 'approved',
           versions = (
               select coalesce(jsonb_agg(
                   case when (v->>'versionNumber')::int = job.current_version
                        then v || jsonb_build_object('status', 'approved', 'feedback', 'Aprovado pelo cliente.')
                        else v
                   end
                   order by ord
               ), '[]'::jsonb)
               from jsonb_array_elements(coalesce(job.versions, '[]'::jsonb)) with ordinality as t(v, ord)
           )
     where id = job.id;

    insert into public.activity_logs (workspace_id, user_name, action, target)
    values (job.workspace_id, quem, 'Aprovou o conteúdo', 'Job: ' || job.title);

    insert into public.notifications (workspace_id, title, message, type, read, link_context)
    values (
        job.workspace_id,
        'Conteúdo Aprovado! 🎉',
        quem || ' aprovou "' || job.title || '". Pronto para agendamento.',
        'approval',
        false,
        jsonb_build_object('tab', 'publicacoes', 'jobId', job.id, 'clientId', job.client_id)
    );

    return true;
end;
$$;

create or replace function public.portal_pedir_ajuste(
    p_token text,
    p_job_id uuid,
    p_feedback text,
    p_quem text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    usuario public.client_users;
    cliente public.clients;
    job public.jobs;
    quem text;
    texto text := trim(coalesce(p_feedback, ''));
begin
    if texto = '' then
        return false;
    end if;

    usuario := private.portal_usuario(p_token);
    if usuario.id is null then
        return false;
    end if;

    quem := coalesce(nullif(trim(p_quem), ''), usuario.name, usuario.email);

    select * into cliente from public.clients where id = usuario.client_id;
    if cliente.id is null then
        return false;
    end if;

    select * into job from public.jobs where id = p_job_id and client_id = cliente.id;
    if not found then
        return false;
    end if;

    update public.jobs
       set status = 'in_adjustment',
           last_feedback = texto,
           versions = (
               select coalesce(jsonb_agg(
                   case when (v->>'versionNumber')::int = job.current_version
                        then v || jsonb_build_object('status', 'rejected', 'feedback', texto)
                        else v
                   end
                   order by ord
               ), '[]'::jsonb)
               from jsonb_array_elements(coalesce(job.versions, '[]'::jsonb)) with ordinality as t(v, ord)
           )
     where id = job.id;

    insert into public.activity_logs (workspace_id, user_name, action, target)
    values (job.workspace_id, quem, 'Solicitou ajuste', 'Job: ' || job.title || ' — "' || texto || '"');

    insert into public.notifications (workspace_id, title, message, type, read, link_context)
    values (
        job.workspace_id,
        'Pedido de Ajuste Solicitado',
        quem || ' solicitou ajuste em "' || job.title || '": ' || left(texto, 60),
        'adjustment',
        false,
        jsonb_build_object('tab', 'conteudos', 'jobId', job.id, 'clientId', job.client_id)
    );

    return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Enviar material: só editor.
--
-- Continua devolvendo jsonb. Trocar para boolean exigiria derrubar a função
-- antes, e o cliente atual lê o material criado da resposta.
-- ---------------------------------------------------------------------
create or replace function public.portal_enviar_material(
    p_token text,
    p_titulo text,
    p_categoria text,
    p_url text,
    p_notas text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    usuario public.client_users;
    cliente public.clients;
    novo public.client_materials;
begin
    usuario := private.portal_usuario(p_token);
    if usuario.id is null or usuario.role <> 'editor' then
        return null;
    end if;

    if trim(coalesce(p_titulo, '')) = '' then
        return null;
    end if;

    select * into cliente from public.clients where id = usuario.client_id;
    if cliente.id is null then
        return null;
    end if;

    insert into public.client_materials
        (workspace_id, client_id, client_name, title, category, url, thumbnail_url, notes, status)
    values (
        cliente.workspace_id,
        cliente.id,
        cliente.name,
        trim(p_titulo),
        coalesce(nullif(trim(coalesce(p_categoria, '')), ''), 'photo'),
        coalesce(nullif(trim(coalesce(p_url, '')), ''), ''),
        nullif(trim(coalesce(p_url, '')), ''),
        nullif(trim(coalesce(p_notas, '')), ''),
        'recebido'
    )
    returning * into novo;

    insert into public.notifications (workspace_id, title, message, type, read, link_context)
    values (
        cliente.workspace_id,
        'Novo material enviado',
        coalesce(usuario.name, usuario.email) || ' enviou "' || trim(p_titulo) || '".',
        'system',
        false,
        jsonb_build_object('tab', 'clientes', 'clientId', cliente.id)
    );

    return to_jsonb(novo);
end;
$$;

-- ---------------------------------------------------------------------
-- Arquivos, senhas e briefing pelo portal: só editor.
--
-- Uma função e uma lista fechada de campos, em vez de três funções quase
-- iguais: a autorização e o que pode ser escrito ficam no mesmo lugar, e não
-- há como adicionar um campo novo sem passar por aqui.
--
-- Campo fora da lista levanta exceção em vez de ser ignorado — gravação que
-- volta "ok" sem gravar é exatamente a tela que mente sobre o que entregou.
--
-- `invoices` não está na lista de propósito: o editor **lê** nota fiscal,
-- quem emite é a agência.
-- ---------------------------------------------------------------------
create or replace function public.portal_salvar_dados(p_token text, p_campos jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    usuario public.client_users;
    permitidos text[] := array['files', 'passwords', 'briefing'];
    chave text;
    chaves text[];
begin
    usuario := private.portal_usuario(p_token);
    if usuario.id is null or usuario.role <> 'editor' then
        raise exception 'Só um editor pode alterar os dados do cliente.' using errcode = '42501';
    end if;

    if p_campos is null or jsonb_typeof(p_campos) <> 'object' then
        raise exception 'Nada para salvar.' using errcode = '22023';
    end if;

    select array_agg(k) into chaves from jsonb_object_keys(p_campos) as k;

    if chaves is null then
        return false;
    end if;

    foreach chave in array chaves loop
        if not (chave = any (permitidos)) then
            raise exception 'Campo % não pode ser alterado pelo portal.', chave using errcode = '42501';
        end if;
    end loop;

    update public.clients
       set files     = case when p_campos ? 'files'     then p_campos->'files'     else files end,
           passwords = case when p_campos ? 'passwords' then p_campos->'passwords' else passwords end,
           briefing  = case when p_campos ? 'briefing'  then p_campos->'briefing'  else briefing end
     where id = usuario.client_id;

    insert into public.activity_logs (workspace_id, user_name, action, target)
    values (
        usuario.workspace_id,
        coalesce(usuario.name, usuario.email),
        'Alterou ' || array_to_string(chaves, ', ') || ' pelo portal',
        (select name from public.clients where id = usuario.client_id)
    );

    return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Usuários pelo portal: só editor.
--
-- O editor cria aprovadores e outros editores do mesmo cliente. Não escolhe
-- cliente: o dele vem da sessão — passar `client_id` por parâmetro seria
-- exatamente o buraco que a versão antiga do portal tinha na URL.
-- ---------------------------------------------------------------------
create or replace function public.portal_usuarios(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    usuario public.client_users;
begin
    usuario := private.portal_usuario(p_token);
    if usuario.id is null or usuario.role <> 'editor' then
        return null;
    end if;

    return coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', u.id,
            'nome', u.name,
            'email', u.email,
            'papel', u.role,
            'ativo', u.ativo,
            'ultimo_acesso', u.ultimo_acesso,
            'created_at', u.created_at
        ) order by u.created_at)
        from public.client_users u
        where u.client_id = usuario.client_id
    ), '[]'::jsonb);
end;
$$;

create or replace function public.portal_criar_usuario(
    p_token text,
    p_email text,
    p_nome text,
    p_papel text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    usuario public.client_users;
    alvo text := lower(trim(coalesce(p_email, '')));
    papel text := lower(trim(coalesce(p_papel, 'aprovador')));
    novo public.client_users;
begin
    usuario := private.portal_usuario(p_token);
    if usuario.id is null or usuario.role <> 'editor' then
        raise exception 'Só um editor pode criar usuários.' using errcode = '42501';
    end if;

    if alvo = '' or position('@' in alvo) = 0 then
        raise exception 'Informe um e-mail válido.' using errcode = '22023';
    end if;

    if papel not in ('aprovador', 'editor') then
        raise exception 'Papel inválido.' using errcode = '22023';
    end if;

    insert into public.client_users
        (workspace_id, client_id, email, name, role, criado_por_cliente)
    values (
        usuario.workspace_id,
        usuario.client_id,
        alvo,
        nullif(trim(coalesce(p_nome, '')), ''),
        papel,
        usuario.id
    )
    on conflict (client_id, lower(email)) do update
        set ativo = true,
            role = excluded.role,
            name = coalesce(excluded.name, public.client_users.name)
    returning * into novo;

    return jsonb_build_object(
        'id', novo.id,
        'nome', novo.name,
        'email', novo.email,
        'papel', novo.role,
        'ativo', novo.ativo
    );
end;
$$;

create or replace function public.portal_remover_usuario(p_token text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    usuario public.client_users;
    afetadas int;
begin
    usuario := private.portal_usuario(p_token);
    if usuario.id is null or usuario.role <> 'editor' then
        raise exception 'Só um editor pode remover usuários.' using errcode = '42501';
    end if;

    -- Ninguém se remove: o cliente ficaria sem editor nenhum se o último
    -- fizesse isso por engano, e não há tela de recuperação do outro lado.
    if p_id = usuario.id then
        raise exception 'Você não pode remover o próprio acesso.' using errcode = '42501';
    end if;

    delete from public.client_users
     where id = p_id
       and client_id = usuario.client_id;

    get diagnostics afetadas = row_count;
    return afetadas > 0;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões.
--
-- As funções por token seguem abertas para anon: quem chega ao portal não
-- tem sessão do Supabase, e a credencial é o token — que a sessão recorta.
-- Emitir e conferir código continuam só para service_role.
-- ---------------------------------------------------------------------
grant execute on function public.portal_dados(text) to anon, authenticated;
grant execute on function public.portal_aprovar(text, uuid, text) to anon, authenticated;
grant execute on function public.portal_pedir_ajuste(text, uuid, text, text) to anon, authenticated;
grant execute on function public.portal_enviar_material(text, text, text, text, text) to anon, authenticated;
grant execute on function public.portal_salvar_dados(text, jsonb) to anon, authenticated;
grant execute on function public.portal_usuarios(text) to anon, authenticated;
grant execute on function public.portal_criar_usuario(text, text, text, text) to anon, authenticated;
grant execute on function public.portal_remover_usuario(text, uuid) to anon, authenticated;

revoke all on function public.portal_emitir_codigo(text, text) from public, anon, authenticated;
revoke all on function public.portal_conferir_codigo(text, text) from public, anon, authenticated;
grant execute on function public.portal_emitir_codigo(text, text) to service_role;
grant execute on function public.portal_conferir_codigo(text, text) to service_role;

-- Os dois resolvedores antigos saem de cena.
--
-- `private.portal_cliente` achava o cliente pelo `clients.portal_token` e
-- `private.portal_cliente_por_email` pelo e-mail em `clients`/`contacts` —
-- os dois entregavam a linha inteira sem nenhuma noção de papel. Nada mais
-- os chama; deixá-los de pé manteria vivo o caminho que o recorte fecha.
drop function if exists private.portal_cliente(text);
drop function if exists private.portal_cliente_por_email(text);
