-- Revisões: o cliente responde na aprovação, e o job para de vazar o interno.
--
-- Duas coisas nesta migração, e a segunda foi encontrada ao escrever a
-- primeira.
--
-- =============================================================================
-- 1. `portal_dados` devolvia a LINHA INTEIRA do job
-- =============================================================================
--
-- É a armadilha 10 outra vez, agora em `jobs`. A regra estava escrita para
-- `clients` — *"a função responde com `to_jsonb(cliente)`, que é a linha
-- inteira; coluna nova nasce visível no portal sem ninguém ter decidido
-- isso"* — e ninguém aplicou o mesmo raciocínio ao `jobs`, que usa
-- `to_jsonb(j)` do mesmo jeito.
--
-- O que ia para o navegador do cliente sem ninguém ter decidido:
--
--   draft               o texto de trabalho da agência. O CLAUDE.md descreve
--                       essa coluna como "versão descartada, gancho, **o que o
--                       cliente falou na reunião**" — ou seja, exatamente o
--                       tipo de anotação que a agência escreve *sobre* a
--                       conversa, e que o cliente agora lia.
--   timesheet_minutes   quantos minutos a agência gastou na peça. É o custo
--                       dela, e num relacionamento por pacote é o número que
--                       ela menos quer entregar.
--   designer_id,        quem da equipe fez. A agência pode ser uma pessoa só,
--   copywriter_id,      ou terceirizar — nos dois casos é decisão dela contar.
--   social_media_id
--   checklist           o processo interno de produção.
--   campaign,           estratégia: para quem a peça foi desenhada e em que
--   target_audience,    etapa do funil. É o que a agência vende, não o que ela
--   funnel_stage        entrega.
--   deadline_production o prazo interno da equipe — diferente do prazo de
--                       aprovação, que é o que o cliente precisa saber.
--
-- Esconder isso na tela não resolveria: o dado já estaria no navegador, e
-- **o recorte por papel é do banco, não da tela**. Quem quisesse ver abriria
-- a aba de rede.
--
-- `deadline_production` fica, e é a única da lista que fica: o portal o lê
-- hoje para mostrar prazo. Tirá-lo quebraria a tela do cliente, e o valor dele
-- não é segredo — é a data que a agência já combinou.
--
-- =============================================================================
-- 2. `portal_comentar`: o cliente responde na aprovação
-- =============================================================================
--
-- No portal não há sessão, então `useColecaoSincronizada` sai cedo e toda
-- mutação feita de lá morre no estado da aba (armadilha 10). Sem este RPC, o
-- chat seria mais uma tela que mostra o que nunca gravou — foi assim que o
-- envio de material ficou decorativo por meses.
--
-- A thread já existe: `jobs.comments` é jsonb e cada item tem `isClient`. Não
-- precisou de tabela nova, e isso é bom — tabela nova traria RLS nova para
-- errar.
--
-- **O `isClient` é decidido aqui, nunca recebido.** Se ele viesse no
-- parâmetro, quem chamasse a função escolheria aparecer como a agência dentro
-- da própria thread do cliente.

-- -----------------------------------------------------------------------------
-- 1. O recorte
-- -----------------------------------------------------------------------------

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

    -- Interno da agência, para papel nenhum. Ver o cabeçalho.
    cliente_json := cliente_json - 'annotations' - 'notes';

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
        -- A subtração vale para **todos** os papéis, inclusive o editor: o
        -- editor é o cliente, e nada disso é dele. Por isso ela mora aqui e
        -- não dentro de um `if usuario.role`.
        'jobs', coalesce((
            select jsonb_agg(
                (to_jsonb(j)
                    - 'draft'
                    - 'timesheet_minutes'
                    - 'designer_id'
                    - 'copywriter_id'
                    - 'social_media_id'
                    - 'checklist'
                    - 'campaign'
                    - 'target_audience'
                    - 'funnel_stage'
                ) order by j.scheduled_date
            )
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

grant execute on function public.portal_dados(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. O chat
-- -----------------------------------------------------------------------------

create or replace function public.portal_comentar(
    p_token text,
    p_job_id uuid,
    p_texto text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    usuario public.client_users;
    cliente public.clients;
    job public.jobs;
    texto text := trim(coalesce(p_texto, ''));
    novo jsonb;
begin
    if texto = '' then
        return null;
    end if;

    -- Texto longo demais não é conversa, é payload. O corte é generoso e
    -- existe para a linha do banco não virar um lugar de guardar arquivo.
    if length(texto) > 4000 then
        texto := left(texto, 4000);
    end if;

    usuario := private.portal_usuario(p_token);
    if usuario.id is null then
        return null;
    end if;

    select * into cliente from public.clients where id = usuario.client_id;
    if cliente.id is null then
        return null;
    end if;

    -- **O job tem que ser do cliente deste token.** Sem esta linha, quem
    -- tivesse um token qualquer comentaria no conteúdo de outro cliente —
    -- e o comentário apareceria para a agência como se fosse dele.
    select * into job from public.jobs where id = p_job_id and client_id = cliente.id;
    if not found then
        return null;
    end if;

    novo := jsonb_build_object(
        'id', gen_random_uuid(),
        'authorName', coalesce(nullif(trim(usuario.name), ''), 'Cliente'),
        'authorRole', 'client',
        'authorAvatar', '',
        -- Decidido aqui, nunca recebido: como parâmetro, quem chamasse
        -- escolheria aparecer como a agência dentro da thread do cliente.
        'isClient', true,
        'text', texto,
        'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    );

    update public.jobs
       set comments = coalesce(comments, '[]'::jsonb) || jsonb_build_array(novo)
     where id = job.id;

    -- A agência precisa **saber** que o cliente respondeu. Sem isto o chat
    -- seria uma caixa onde a mensagem entra e ninguém olha — que é pior que
    -- não ter chat, porque o cliente fica esperando resposta.
    insert into public.notifications (workspace_id, title, message, type, read, link_context)
    values (
        job.workspace_id,
        'Mensagem do cliente',
        coalesce(nullif(trim(usuario.name), ''), 'Cliente') || ' comentou em "' ||
            job.title || '": ' || left(texto, 60),
        'comment',
        false,
        jsonb_build_object('jobId', job.id, 'clientId', cliente.id)
    );

    return novo;
end;
$$;

-- O portal é anônimo por definição: quem chega prova quem é pelo token, e o
-- token é conferido dentro da função.
grant execute on function public.portal_comentar(text, uuid, text) to anon, authenticated;
