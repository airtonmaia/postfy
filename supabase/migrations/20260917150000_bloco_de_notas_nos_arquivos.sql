-- O bloco de notas passa a ser uma linha da lista de arquivos.
--
-- A aba Arquivos tinha duas listas empilhadas — "Arquivos e Pastas" e
-- "Anotações" — e elas são a mesma pergunta para quem usa: *o que a agência
-- guardou sobre este cliente?* Agora é uma lista só, com tipo: anexo, link ou
-- bloco de notas.
--
-- =============================================================================
-- Duas coisas precisam ser verdade ao mesmo tempo, e elas puxam para lados
-- opostos
-- =============================================================================
--
-- `clients.annotations` **nunca sai da agência**: é o que a equipe escreve
-- *sobre* o cliente, e `portal_dados` a subtrai para todos os papéis — está no
-- CLAUDE.md e é guardado por `tests/anotacoes-do-cliente.test.ts`.
--
-- `clients.files`, ao contrário, **é lido pelo cliente editor** no portal: é lá
-- que ele busca a identidade visual e manda foto.
--
-- Mudar a nota de coluna, portanto, é mudá-la de lado. Duas correções seguram
-- isso, e a segunda é a que ninguém veria falhar:
--
--   1. `portal_dados` passa a **filtrar as linhas de nota** de `files`. Não
--      basta subtrair uma chave como se faz com `passwords`: aqui o que sai é
--      um item de dentro do array.
--
--   2. `portal_salvar_dados` passa a **preservar** as linhas de nota na
--      gravação. Ela grava `files = p_campos->'files'`, o array inteiro que o
--      navegador mandou — e o navegador do cliente nunca recebeu as notas.
--      Sem esta correção, o primeiro arquivo que o cliente enviasse pelo portal
--      **apagaria todas as anotações da agência**, em silêncio, sem erro em
--      lugar nenhum. É a troca de um vazamento por uma perda, que é pior.
--
-- =============================================================================
-- A linha de nota
-- =============================================================================
--
--   { id, name: <título>, content: <texto>, category: 'notas',
--     url: '', size: '', uploadedAt: <data>, kind: 'nota' }
--
-- `kind` já existia com 'arquivo' e 'link' — o terceiro valor entra ali em vez
-- de numa coluna nova, porque é a mesma pergunta que `tipoDoArquivo()` já
-- responde.

-- -----------------------------------------------------------------------------
-- 1. As anotações que já existem viram linhas da lista
-- -----------------------------------------------------------------------------
--
-- **Repetível**: só entra a anotação cujo `id` ainda não está em `files`.
-- Aplicada duas vezes — o que acontece quando a outra máquina aplica sem saber
-- que já foi —, a segunda passada não duplica nada.
--
-- `annotations` **não é apagada**. A coluna fica como estava, com o conteúdo
-- intacto: se algo aqui estiver errado, o dado original continua no banco para
-- ser relido. Remover coluna que a `main` ainda pode ler derruba produção antes
-- de o PR existir — é a regra do banco compartilhado.

update public.clients c
   set files = coalesce(c.files, '[]'::jsonb) || (
       select coalesce(jsonb_agg(
           jsonb_build_object(
               'id', a->>'id',
               'name', coalesce(nullif(a->>'title', ''), 'Bloco de notas'),
               'content', coalesce(a->>'content', ''),
               'category', 'notas',
               'url', '',
               'size', '',
               'uploadedAt', coalesce(
                   left(coalesce(a->>'updatedAt', a->>'createdAt', ''), 10),
                   ''
               ),
               'kind', 'nota'
           )
       ), '[]'::jsonb)
       from jsonb_array_elements(coalesce(c.annotations, '[]'::jsonb)) as a
       where not exists (
           select 1
           from jsonb_array_elements(coalesce(c.files, '[]'::jsonb)) as f
           where f->>'id' = a->>'id'
       )
   )
 where jsonb_typeof(coalesce(c.annotations, '[]'::jsonb)) = 'array'
   and jsonb_array_length(coalesce(c.annotations, '[]'::jsonb)) > 0;

-- -----------------------------------------------------------------------------
-- 2. O portal não recebe as linhas de nota
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

    -- Interno da agência, para papel nenhum.
    cliente_json := cliente_json - 'annotations' - 'notes';

    /*
      **O bloco de notas mora em `files` e continua sendo interno.**

      Subtrair a chave não serve: `files` é a lista que o cliente precisa ver.
      O que sai é **item por item**, pelo `kind` — e vale para todos os papéis,
      inclusive o editor, porque o editor é o cliente.
    */
    cliente_json := jsonb_set(
        cliente_json,
        '{files}',
        coalesce((
            select jsonb_agg(f)
            from jsonb_array_elements(coalesce(cliente.files, '[]'::jsonb)) as f
            where coalesce(f->>'kind', '') <> 'nota'
        ), '[]'::jsonb)
    );

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
        -- editor é o cliente, e nada disto é dele.
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
-- 3. Gravar pelo portal não pode apagar o que o portal não viu
-- -----------------------------------------------------------------------------

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
    arquivos jsonb;
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

    /*
      **O que o portal manda de volta não contém as notas, porque ele nunca as
      recebeu.**

      A gravação era `files = p_campos->'files'`, o array inteiro. Com o bloco
      de notas morando em `files`, o primeiro arquivo enviado pelo cliente
      apagaria **todas as anotações da agência** — em silêncio, sem erro em
      lugar nenhum, e sem ninguém desconfiar até alguém procurar uma anotação
      que não está mais lá.

      Por isso as linhas de nota são lidas do banco e recolocadas aqui. O
      cliente escreve só a parte que é dele; o que ele não vê, ele não apaga.

      A conferência é por `kind`, e não pelos ids que faltam: um id ausente
      também é o que acontece quando ele **exclui** um arquivo de verdade, e
      confundir os dois faria a exclusão parar de funcionar.
    */
    if p_campos ? 'files' then
        select coalesce(jsonb_agg(f), '[]'::jsonb) into arquivos
          from jsonb_array_elements(coalesce(p_campos->'files', '[]'::jsonb)) as f
         where coalesce(f->>'kind', '') <> 'nota';

        arquivos := arquivos || coalesce((
            select jsonb_agg(f)
              from public.clients c,
                   jsonb_array_elements(coalesce(c.files, '[]'::jsonb)) as f
             where c.id = usuario.client_id
               and coalesce(f->>'kind', '') = 'nota'
        ), '[]'::jsonb);
    end if;

    update public.clients
       set files     = case when p_campos ? 'files'     then arquivos              else files end,
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

grant execute on function public.portal_salvar_dados(text, jsonb) to anon, authenticated;
