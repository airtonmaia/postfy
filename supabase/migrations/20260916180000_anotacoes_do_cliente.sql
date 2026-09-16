-- Anotações da agência sobre o cliente.
--
-- `clients.notes` já existia — um `text` único, livre, sem título e sem data.
-- Serve para um recado; não serve para o que foi pedido: vários blocos, cada
-- um com título, com visualizar, editar e excluir por bloco. Ela **fica onde
-- está**, porque a `main` ainda a lê (regra do banco compartilhado: nada de
-- `drop` de coluna que a produção usa).
--
-- O formato acompanha `files`, `passwords` e `contacts`: jsonb na própria
-- linha do cliente. São poucos itens por cliente, sempre lidos junto com ele e
-- nunca consultados por conta própria — tabela separada custaria um join e uma
-- política de RLS a mais para nada.

alter table public.clients
    add column if not exists annotations jsonb not null default '[]'::jsonb;

comment on column public.clients.annotations is
    'Anotações internas da agência: [{id, title, content, createdAt, updatedAt}]. '
    'Nunca sai para o Portal do Cliente — ver portal_dados abaixo.';

-- ---------------------------------------------------------------------------
-- O recorte do portal, e esta é a parte que não é detalhe.
--
-- `portal_dados` monta a resposta com `to_jsonb(cliente)`, que é a **linha
-- inteira**. Coluna nova, portanto, nasce visível para quem entra pelo portal
-- sem ninguém ter decidido isso — foi assim que `passwords`, `invoices` e
-- `briefing` saíram na primeira versão, e é por isso que a subtração é
-- explícita e tem guarda.
--
-- Duas colunas saem aqui, para **todos os papéis**:
--
--   `annotations` — o editor é o cliente, e a anotação é o que a agência
--   escreve *sobre* ele ("atrasa aprovação", "renegociar contrato"). É o texto
--   que menos pode aparecer do outro lado.
--
--   `notes` — a nota interna que já aparece no card do cliente, em
--   `ClientsView`. Ela nunca foi recortada: o portal não a desenha em tela,
--   mas **recebia o texto** em toda abertura, à vista de quem abrisse o
--   inspetor. Esconder na tela com o dado já no navegador é a armadilha 9, e a
--   regra do projeto é que o recorte é do banco.
--
-- O resto do corpo é o original de `20260910160000_usuarios_do_cliente.sql`,
-- palavra por palavra: o bloco `workspace` (que pinta o portal com a marca da
-- agência), a ordenação dos jobs por data e o `case` que só devolve materiais
-- ao editor. `create or replace` substitui a função inteira — reescrevê-la de
-- memória é como se perde um desses sem nenhum erro aparecer.
-- ---------------------------------------------------------------------------

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

grant execute on function public.portal_dados(text) to anon, authenticated;
