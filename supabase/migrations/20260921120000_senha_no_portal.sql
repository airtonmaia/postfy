-- =====================================================================
-- Portal do Cliente: entrar com e-mail e senha.
--
-- O código de seis dígitos por e-mail continua existindo, e continua sendo
-- a porta de saída. O que ele não é mais é o **único** caminho: ele depende
-- de a mensagem sair da fila, chegar, não cair em spam e a pessoa achar —
-- e quem está do outro lado é um cliente que quer aprovar um post, não
-- alguém disposto a esperar. Na prática isso estava custando aprovação.
--
-- A senha é escolhida (ou gerada) pela agência na ficha do cliente e vale
-- desde o primeiro acesso. Quem não tiver senha continua entrando por
-- código — nenhum acesso existente é derrubado por esta migração.
--
-- **É bcrypt, não sha256.** `portal_codigos` guarda o código com
-- `digest(..., 'sha256')` e está certo para o que ele é: seis dígitos, dez
-- minutos de vida e cinco tentativas. Senha é outra coisa — é longa, dura
-- meses e costuma ser reaproveitada em outros lugares. Um sha256 sem sal
-- cai numa tabela arco-íris pronta, e o estrago sairia deste produto para a
-- vida da pessoa. `crypt` com `gen_salt('bf')` tem sal por linha e custo
-- ajustável.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A senha mora no usuário do portal, não no cliente.
--
-- `clients` é a empresa; quem entra é uma pessoa, com papel próprio desde
-- a migração de `client_users`. Uma senha por cliente faria duas pessoas
-- dividirem a mesma credencial — e aí `ultimo_acesso`, o autor da
-- aprovação e o recorte por papel viram ficção.
--
-- `bloqueado_ate` e `tentativas_de_senha` moram aqui pelo mesmo motivo do
-- `tentativas` de `portal_codigos`: o limite da rota é por container da
-- Vercel, e força bruta não respeita fronteira de container.
-- ---------------------------------------------------------------------
alter table public.client_users
    add column if not exists senha_hash text,
    add column if not exists senha_definida_em timestamptz,
    add column if not exists tentativas_de_senha integer not null default 0,
    add column if not exists bloqueado_ate timestamptz;

comment on column public.client_users.senha_hash is
    'bcrypt (extensions.crypt). Nunca sai do banco: nenhuma consulta do app o seleciona.';

-- ---------------------------------------------------------------------
-- O mínimo é conferido no banco, não só na tela.
--
-- A tela é uma sugestão — quem chamar a RPC direto não passa por ela. E o
-- caminho que importa aqui é o de dentro: a função que define a senha é a
-- mesma para a agência e para qualquer outro chamador futuro.
-- ---------------------------------------------------------------------
create or replace function private.hash_de_senha(p_senha text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
    if length(coalesce(p_senha, '')) < 8 then
        raise exception 'A senha precisa de pelo menos 8 caracteres.' using errcode = '22023';
    end if;

    return extensions.crypt(p_senha, extensions.gen_salt('bf', 10));
end;
$$;

-- ---------------------------------------------------------------------
-- A agência define (ou troca) a senha de um usuário do portal.
--
-- `security definer` porque o hash é feito **aqui**: mandar o navegador
-- calcular bcrypt exigiria a biblioteca no bundle e, pior, deixaria a
-- gravação aceitar qualquer string como "hash". A conferência de papel é a
-- mesma da policy de UPDATE da tabela — repetida de propósito, porque uma
-- função `security definer` não passa pela RLS.
--
-- **Trocar a senha derruba as sessões abertas daquela pessoa.** Senha é
-- trocada justamente quando se desconfia de que outra pessoa a tem; deixar
-- as sessões de pé faria a troca ser decorativa.
-- ---------------------------------------------------------------------
create or replace function public.definir_senha_do_portal(p_id uuid, p_senha text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    alvo public.client_users;
begin
    select * into alvo from public.client_users where id = p_id;

    if alvo.id is null then
        raise exception 'Usuário não encontrado.' using errcode = '22023';
    end if;

    if (select private.papel_na_agencia(alvo.workspace_id)) not in ('owner', 'admin', 'manager') then
        raise exception 'Sem permissão para definir a senha deste usuário.' using errcode = '42501';
    end if;

    update public.client_users
       set senha_hash = private.hash_de_senha(p_senha),
           senha_definida_em = now(),
           tentativas_de_senha = 0,
           bloqueado_ate = null
     where id = p_id;

    delete from public.portal_sessoes where client_user_id = p_id;

    return jsonb_build_object('id', p_id, 'senha_definida_em', now());
end;
$$;

-- ---------------------------------------------------------------------
-- A agência tira a senha: a pessoa volta a entrar só por código.
--
-- Existe porque o contrário existe. Sem isto, uma senha entregue por
-- engano à pessoa errada só poderia ser **trocada**, nunca removida — e
-- quem mandou a senha no grupo errado quer desfazer, não rodar outra.
-- ---------------------------------------------------------------------
create or replace function public.remover_senha_do_portal(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    alvo public.client_users;
begin
    select * into alvo from public.client_users where id = p_id;

    if alvo.id is null then
        return false;
    end if;

    if (select private.papel_na_agencia(alvo.workspace_id)) not in ('owner', 'admin', 'manager') then
        raise exception 'Sem permissão para remover a senha deste usuário.' using errcode = '42501';
    end if;

    update public.client_users
       set senha_hash = null,
           senha_definida_em = null,
           tentativas_de_senha = 0,
           bloqueado_ate = null
     where id = p_id;

    delete from public.portal_sessoes where client_user_id = p_id;

    return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Entrar com e-mail e senha. Devolve o token da sessão, como o código.
--
-- **Só `service_role`**, pela mesma razão de `portal_conferir_codigo`: sem
-- o limite de taxa da rota na frente, esta função é um oráculo de senha
-- chamável direto do navegador de qualquer um.
--
-- O mesmo e-mail pode ser usuário de dois clientes diferentes (agência que
-- atende duas empresas do mesmo dono) — o índice único é por cliente. Por
-- isso a busca **percorre** os candidatos e entra no primeiro cuja senha
-- confere, em vez de pegar o mais antigo e testar só ele: pegar um só faria
-- a senha certa do segundo cliente ser recusada sem explicação.
-- ---------------------------------------------------------------------
create or replace function public.portal_entrar_com_senha(p_email text, p_senha text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    alvo text := lower(trim(coalesce(p_email, '')));
    candidato public.client_users;
    escolhido public.client_users;
    novo_token text;
begin
    if alvo = '' or coalesce(p_senha, '') = '' then
        return null;
    end if;

    for candidato in
        select u.*
        from public.client_users u
        join public.clients c on c.id = u.client_id
        where lower(u.email) = alvo
          and u.ativo
          and u.senha_hash is not null
          and c.status = 'active'
        order by u.created_at
    loop
        -- Bloqueado agora não é candidato: sem isto, dez erros por minuto
        -- continuariam sendo dez conferências de bcrypt por minuto.
        if candidato.bloqueado_ate is not null and candidato.bloqueado_ate > now() then
            continue;
        end if;

        if candidato.senha_hash = extensions.crypt(p_senha, candidato.senha_hash) then
            escolhido := candidato;
            exit;
        end if;

        -- Dez erros seguidos param por quinze minutos. **O bloqueio não
        -- tranca a pessoa para fora do portal** — o código por e-mail
        -- continua valendo —, e é isso que torna o limite seguro: sem a
        -- outra porta, bastaria errar a senha de alguém de propósito para
        -- deixá-lo sem acesso na véspera da aprovação.
        update public.client_users
           set tentativas_de_senha = candidato.tentativas_de_senha + 1,
               bloqueado_ate = case
                   when candidato.tentativas_de_senha + 1 >= 10 then now() + interval '15 minutes'
                   else bloqueado_ate
               end
         where id = candidato.id;
    end loop;

    if escolhido.id is null then
        return null;
    end if;

    novo_token := encode(extensions.gen_random_bytes(32), 'hex');

    -- Trinta dias, o mesmo da entrada por código: é a mesma sessão, o que
    -- muda é como ela foi provada.
    insert into public.portal_sessoes (token, client_user_id, expira_em)
    values (novo_token, escolhido.id, now() + interval '30 days');

    update public.client_users
       set ultimo_acesso = now(),
           tentativas_de_senha = 0,
           bloqueado_ate = null
     where id = escolhido.id;

    delete from public.portal_sessoes where expira_em < now() - interval '7 days';

    return novo_token;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões.
--
-- `definir_senha_do_portal` e `remover_senha_do_portal` vão para
-- `authenticated`: quem chama é a agência, com sessão, e a função confere o
-- papel dela na agência **dona daquele usuário** — não na agência que o
-- navegador afirmar.
--
-- `portal_entrar_com_senha` fica fora do alcance do navegador, como as duas
-- funções do código. E `private.hash_de_senha` não recebe EXECUTE de
-- ninguém: ela é chamada de dentro das funções `security definer`, e o
-- schema `private` não concede USAGE para anon/authenticated (armadilha 7).
-- ---------------------------------------------------------------------
grant execute on function public.definir_senha_do_portal(uuid, text) to authenticated;
grant execute on function public.remover_senha_do_portal(uuid) to authenticated;

revoke all on function public.portal_entrar_com_senha(text, text) from public, anon, authenticated;
grant execute on function public.portal_entrar_com_senha(text, text) to service_role;
