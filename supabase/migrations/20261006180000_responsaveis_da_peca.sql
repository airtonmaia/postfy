/*
  Quem da equipe é responsável pela peça.

  `jobs.designer_id`, `copywriter_id` e `social_media_id` existem desde a
  primeira migração e **nada no produto escreve ou lê os três** — a família do
  `trial_ends_at`. A tela de detalhe rotulava `currentUser.name` como
  "Responsável", o que mostra quem está **olhando** a peça, não quem a fez:
  numa agência de quatro pessoas, cada uma abre a mesma peça e lê o próprio
  nome.

  A coluna é uma **lista**, e não o preenchimento das três antigas, porque a
  pergunta que a agência faz é "quem está nesta peça" — a mesma peça costuma
  ter duas pessoas, e separar por função obrigaria a escolher uma gaveta para
  quem faz as duas coisas. As três colunas antigas ficam onde estão: removê-las
  derrubaria a `main`, que ainda as mapeia, e elas não atrapalham ninguém.

  **Sem chave estrangeira para `auth.users`, de propósito.** O vínculo que
  importa é com a agência, e ele mora em `workspace_members`; uma `fk` em
  `auth.users` impediria remover a conta de alguém que já saiu da equipe sem
  antes limpar todas as peças dela. Quem some da equipe vira um id sem nome, e
  a tela mostra isso em vez de inventar um.
*/
alter table public.jobs
    add column if not exists responsaveis uuid[] not null default '{}';

comment on column public.jobs.responsaveis is
    'Ids de quem da equipe toca esta peça. Lista porque a peça costuma ter mais de uma pessoa.';

/*
  **Coluna nova em `jobs` nasce visível no portal do cliente**, e isto é a
  armadilha 10 deste projeto: `portal_dados` responde com `to_jsonb(j)`, que é
  a linha inteira. Foi assim que `draft`, as horas lançadas e a estratégia de
  campanha foram parar no navegador do cliente sem ninguém ter decidido.

  `responsaveis` é exatamente a categoria que já sai dali — quem da equipe fez
  a peça —, ao lado de `designer_id`, `copywriter_id` e `social_media_id`. A
  subtração vale para **todos os papéis**: o editor é o cliente.

  A função é recriada inteira porque `create or replace` reescreve o corpo
  todo; o resto dela é o que já estava na última definição.
*/
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
                    - 'responsaveis'
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
