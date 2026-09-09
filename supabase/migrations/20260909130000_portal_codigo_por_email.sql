-- =====================================================================
-- Portal do Cliente: entrada por e-mail com código, no lugar do telefone.
--
-- O telefone identificava, não autenticava: quem soubesse o número entrava.
-- Agora o cliente informa o e-mail, recebe um código de 6 dígitos e só entra
-- depois de provar que abriu a caixa dele.
--
-- `portal_entrar(telefone)` é REMOVIDA, não mantida por compatibilidade:
-- deixá-la de pé conservaria exatamente o atalho que esta migração existe
-- para fechar.
-- =====================================================================

drop function if exists public.portal_entrar(text);
drop function if exists private.mesmo_telefone(text, text);
drop function if exists private.variacoes_do_telefone(text);

-- ---------------------------------------------------------------------
-- Códigos emitidos.
--
-- RLS ligada e ZERO políticas, como `social_tokens`: inalcançável por
-- qualquer sessão, anônima ou autenticada. Só a função serverless entra
-- aqui, com a chave de serviço — se o navegador pudesse ler esta tabela,
-- bastaria pedir o código do e-mail alheio e lê-lo em seguida.
--
-- Guardamos o hash, não o código. Um dump da tabela não abre portal nenhum.
-- ---------------------------------------------------------------------
create table if not exists public.portal_codigos (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.clients(id) on delete cascade,
    email text not null,
    codigo_hash text not null,
    expira_em timestamptz not null,
    tentativas integer not null default 0,
    usado_em timestamptz,
    created_at timestamptz not null default now()
);

alter table public.portal_codigos enable row level security;

create index if not exists portal_codigos_email_idx
    on public.portal_codigos (lower(email), created_at desc);

-- ---------------------------------------------------------------------
-- Cliente a partir do e-mail. Procura no cadastro e nos contatos.
--
-- Fica em `private` (sem USAGE para anon/authenticated) porque devolve o
-- vínculo e-mail -> cliente: exposta, viraria um verificador de "este e-mail
-- é cliente de alguma agência aqui?".
-- ---------------------------------------------------------------------
create or replace function private.portal_cliente_por_email(p_email text)
returns public.clients
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    alvo text := lower(trim(coalesce(p_email, '')));
    achado public.clients;
begin
    if alvo = '' or position('@' in alvo) = 0 then
        return null;
    end if;

    select * into achado
    from public.clients c
    where c.status = 'active'
      and (
        lower(coalesce(c.email, '')) = alvo
        or exists (
            select 1
            from jsonb_array_elements(coalesce(c.contacts, '[]'::jsonb)) as contato
            where lower(coalesce(contato->>'email', '')) = alvo
        )
      )
    order by c.created_at
    limit 1;

    return achado;
end;
$$;

-- ---------------------------------------------------------------------
-- Emitir código. Chamada só pela rota serverless (chave de serviço).
--
-- Devolve o cliente e o código em claro para a rota poder enviá-lo por
-- e-mail; é por isso que ela NÃO recebe EXECUTE para anon/authenticated.
-- ---------------------------------------------------------------------
create or replace function public.portal_emitir_codigo(p_email text, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    cliente public.clients;
begin
    cliente := private.portal_cliente_por_email(p_email);
    if cliente.id is null then
        return null;
    end if;

    -- Um código de cada vez por e-mail: pedir de novo invalida o anterior,
    -- senão cada pedido aumentaria a quantidade de códigos válidos.
    update public.portal_codigos
       set usado_em = now()
     where lower(email) = lower(trim(p_email))
       and usado_em is null;

    insert into public.portal_codigos (client_id, email, codigo_hash, expira_em)
    values (
        cliente.id,
        lower(trim(p_email)),
        encode(extensions.digest(p_codigo, 'sha256'), 'hex'),
        now() + interval '10 minutes'
    );

    -- O nome da agência vai junto para o e-mail do código poder dizer de onde
    -- ele veio: "seu código de acesso", sem remetente reconhecível, parece
    -- phishing e é o tipo de mensagem que ninguém abre.
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
-- Conferir o código e devolver o token do portal.
--
-- Cinco tentativas por código: sem isso, seis dígitos caem por força bruta.
-- ---------------------------------------------------------------------
create or replace function public.portal_conferir_codigo(p_email text, p_codigo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    registro public.portal_codigos;
    token text;
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

    select portal_token into token from public.clients where id = registro.client_id;
    return token;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões.
--
-- Emitir e conferir ficam FORA do alcance do navegador: as duas passam pela
-- rota serverless, que é quem tem a chave de serviço e o rate limit. Emitir,
-- porque devolve o código; conferir, porque sem o limite da rota na frente
-- seis dígitos são pouco.
--
-- As funções por token (portal_dados, portal_aprovar, portal_pedir_ajuste,
-- portal_enviar_material) seguem abertas para anon: lá a credencial já foi
-- provada, e o token recorta tudo.
-- ---------------------------------------------------------------------
revoke all on function public.portal_emitir_codigo(text, text) from public, anon, authenticated;
revoke all on function public.portal_conferir_codigo(text, text) from public, anon, authenticated;
grant execute on function public.portal_emitir_codigo(text, text) to service_role;
grant execute on function public.portal_conferir_codigo(text, text) to service_role;
