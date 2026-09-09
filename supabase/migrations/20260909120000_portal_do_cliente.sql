-- =====================================================================
-- Portal do Cliente: acesso sem sessão de equipe.
--
-- Antes desta migração o portal só funcionava como prévia interna. Toda
-- política de RLS é `to authenticated` + `private.e_membro(workspace_id)`,
-- então um cliente abrindo o link não lia `clients` (o telefone digitado
-- nunca casava), não lia `jobs` e não conseguia aprovar nada. A tela de
-- login existia e comparava contra um array que chegava vazio.
--
-- A saída NÃO é afrouxar a RLS: `anon` continua sem enxergar uma linha
-- sequer das tabelas. Todo o portal passa por estas funções `security
-- definer`, que recebem o `portal_token` do cliente e recortam por ele
-- dentro do banco. A superfície exposta é esta lista, e só ela.
--
-- O token é a credencial: `clients.portal_token` já nasce com
-- `encode(gen_random_bytes(24),'hex')`, opaco e não enumerável.
--
-- Limite conhecido: quem souber o telefone cadastrado entra. É o modelo de
-- autenticação que o produto escolheu (login por WhatsApp, sem código de
-- confirmação), e telefone não é segredo. Não há limite de tentativas aqui
-- — se isso virar problema, o lugar de resolver é uma função serverless com
-- rate limit na frente, não este arquivo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Comparação de telefone: espelha src/lib/phone.ts.
--
-- Vive em `private` porque é helper, não endpoint. A regra é a mesma dos
-- dois lados de propósito: casar por substring (`a like '%'||b||'%'`) fazia
-- "999" bater com quase qualquer cliente da base, e foi corrigido no app.
-- Repetir a regra frouxa aqui traria o mesmo bug de volta pela porta dos
-- fundos.
-- ---------------------------------------------------------------------
create or replace function private.variacoes_do_telefone(p_valor text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
    digitos text;
    sem_ddi text;
    saida text[];
begin
    digitos := regexp_replace(coalesce(p_valor, ''), '\D', '', 'g');
    if digitos = '' then
        return '{}'::text[];
    end if;

    if left(digitos, 2) = '55' and length(digitos) > 11 then
        sem_ddi := substr(digitos, 3);
    else
        sem_ddi := digitos;
    end if;

    saida := array[sem_ddi];

    -- 11 dígitos com nono dígito -> a versão de 10
    if length(sem_ddi) = 11 and substr(sem_ddi, 3, 1) = '9' then
        saida := saida || (substr(sem_ddi, 1, 2) || substr(sem_ddi, 4));
    end if;

    -- 10 dígitos -> a versão com nono dígito
    if length(sem_ddi) = 10 then
        saida := saida || (substr(sem_ddi, 1, 2) || '9' || substr(sem_ddi, 3));
    end if;

    return saida;
end;
$$;

-- Mínimo de 10 dígitos (DDD + número) para não casar por acidente.
create or replace function private.mesmo_telefone(a text, b text)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select exists (
        select 1
        from unnest(private.variacoes_do_telefone(a)) as va
        where length(va) >= 10
          and va = any (private.variacoes_do_telefone(b))
    );
$$;

-- Resolve o token no cliente. Uma função só, usada por todas as outras:
-- se o token não existe, nada acontece e ninguém descobre por quê.
create or replace function private.portal_cliente(p_token text)
returns public.clients
language sql
stable
security definer
set search_path = ''
as $$
    select * from public.clients where portal_token = p_token limit 1;
$$;

-- ---------------------------------------------------------------------
-- Entrar: telefone -> token. Devolve o token, nunca o id.
--
-- O id era a chave antiga da URL (`?portal=true&clientId=c-1`), e bastava
-- trocá-lo para abrir o portal de qualquer outro cliente da base.
-- ---------------------------------------------------------------------
create or replace function public.portal_entrar(p_telefone text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    c record;
    contato jsonb;
begin
    if length(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g')) < 10 then
        return null;
    end if;

    for c in
        select id, phone, contacts, portal_token
        from public.clients
        where status = 'active'
        order by created_at
    loop
        if private.mesmo_telefone(c.phone, p_telefone) then
            return c.portal_token;
        end if;

        for contato in
            select * from jsonb_array_elements(coalesce(c.contacts, '[]'::jsonb))
        loop
            if private.mesmo_telefone(contato->>'phone', p_telefone) then
                return c.portal_token;
            end if;
        end loop;
    end loop;

    return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Dados do portal, numa ida só.
--
-- Colunas cruas (snake_case), como viriam de um select normal: o app já tem
-- os mappers em src/lib/mappers.ts, e traduzir aqui criaria uma segunda
-- convenção para manter em dia.
--
-- De `workspaces` só sai o que a tela usa (marca). O resto da linha não tem
-- por que atravessar.
-- ---------------------------------------------------------------------
create or replace function public.portal_dados(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    cliente public.clients;
begin
    cliente := private.portal_cliente(p_token);
    if cliente.id is null then
        return null;
    end if;

    return jsonb_build_object(
        'cliente', to_jsonb(cliente),
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
        'materiais', coalesce((
            select jsonb_agg(to_jsonb(m) order by m.created_at desc)
            from public.client_materials m
            where m.client_id = cliente.id
        ), '[]'::jsonb)
    );
end;
$$;

-- ---------------------------------------------------------------------
-- Aprovar. Espelha o approveJob do PostfyContext: status, a versão corrente
-- marcada, log de atividade e notificação para a agência.
-- ---------------------------------------------------------------------
create or replace function public.portal_aprovar(p_token text, p_job_id uuid, p_quem text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    cliente public.clients;
    job public.jobs;
    quem text := coalesce(nullif(trim(p_quem), ''), 'Cliente');
begin
    cliente := private.portal_cliente(p_token);
    if cliente.id is null then
        return false;
    end if;

    -- O job precisa ser do cliente do token. Sem isto, um token válido
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

-- ---------------------------------------------------------------------
-- Pedir ajuste. Espelha o requestAdjustment.
--
-- O ajuste do health_score do cliente (verde -> amarelo na segunda versão)
-- fica de fora de propósito: é heurística da agência, e daria ao portal uma
-- escrita na linha do cliente que ele não precisa ter.
-- ---------------------------------------------------------------------
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
    cliente public.clients;
    job public.jobs;
    quem text := coalesce(nullif(trim(p_quem), ''), 'Cliente');
    texto text := trim(coalesce(p_feedback, ''));
begin
    if texto = '' then
        return false;
    end if;

    cliente := private.portal_cliente(p_token);
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
-- Envio de material pelo cliente.
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
    cliente public.clients;
    novo public.client_materials;
begin
    cliente := private.portal_cliente(p_token);
    if cliente.id is null or trim(coalesce(p_titulo, '')) = '' then
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
        cliente.name || ' enviou "' || trim(p_titulo) || '".',
        'system',
        false,
        jsonb_build_object('tab', 'clientes', 'clientId', cliente.id)
    );

    return to_jsonb(novo);
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões.
--
-- `private` continua sem USAGE para anon/authenticated (migração inicial),
-- então os helpers de lá não são chamáveis de fora mesmo com EXECUTE — o
-- PostgREST só expõe `public`. As quatro funções de `public` abaixo são a
-- superfície inteira do portal.
--
-- O EXECUTE padrão de `public` já cobre, mas declarar é o que documenta a
-- intenção — e o que quebra o dia em que alguém revogar em bloco.
-- ---------------------------------------------------------------------
grant execute on function public.portal_entrar(text) to anon, authenticated;
grant execute on function public.portal_dados(text) to anon, authenticated;
grant execute on function public.portal_aprovar(text, uuid, text) to anon, authenticated;
grant execute on function public.portal_pedir_ajuste(text, uuid, text, text) to anon, authenticated;
grant execute on function public.portal_enviar_material(text, text, text, text, text) to anon, authenticated;
