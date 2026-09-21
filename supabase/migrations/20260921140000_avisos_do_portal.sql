-- =====================================================================
-- Avisos do portal: a agência fica sabendo quando o cliente abre e o que
-- ele faz lá dentro.
--
-- O painel já recebia a notificação de aprovar, pedir ajuste, comentar e
-- enviar material — `portal_aprovar` e as irmãs gravam em `notifications`
-- desde que existem. **O e-mail nunca saiu.**
--
-- E o motivo é estrutural, não esquecimento: quem enfileira e-mail é
-- `dispararAutomacoes`, que roda no navegador com sessão. No portal não há
-- sessão (armadilha 10), `email_queue` só aceita insert de membro da agência,
-- e por isso a ação do cliente morria no painel. O rótulo em Automações
-- ("quando o cliente aprova um conteúdo") descrevia um disparo que só
-- acontecia quando a **agência** mudava o status — a armadilha do
-- `trial_ends_at`, agora no motor de automações.
--
-- Como o portal é anônimo, a decisão de enfileirar passa a morar aqui, em
-- `private.enfileirar_email_do_portal`. Isso é uma segunda verdade sobre
-- "este e-mail sai?", e vale dizer por que ela é aceitável: o lado do
-- navegador pergunta às `automations` (regra que a agência liga), e este
-- pergunta ao modelo (`email_templates.ativo`, que o dono do produto liga).
-- Se o portal também exigisse regra de automação, **nada sairia por padrão**
-- — não há automação semeada em agência nenhuma —, e a agência concluiria
-- que o aviso não funciona.
--
-- O destinatário é congelado no insert, pela razão de sempre: quem envia é o
-- cron, minutos depois, e ele não tem sessão para perguntar isso.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. As duas listas fechadas recebem o valor novo
--
-- `check` do banco e lista da tela são a mesma decisão em dois lugares, e
-- divergir não quebra nada até alguém escolher o valor novo — longe de quem
-- o escreveu, e com a perda em silêncio. Foi o `feed_story` recusado por
-- quatro dias com `tsc`, vitest e build verdes.
--
-- Os dois `check` são inline no `create table`, então quem deu o nome foi o
-- Postgres: `<tabela>_<coluna>_check`.
-- ---------------------------------------------------------------------
alter table public.email_queue drop constraint if exists email_queue_evento_check;
alter table public.email_queue add constraint email_queue_evento_check
    check (evento in (
        'conteudo_aguardando_aprovacao',
        'conteudo_aprovado',
        'pedido_de_ajuste',
        -- Da aprovação em massa. **Recriar o `check` é reescrever a lista
        -- inteira**, e esquecer um valor que já existe é pior que esquecer o
        -- novo: o `add constraint` valida as linhas gravadas, então a
        -- migração falharia na agência que já usou o lote — ou, sem linha
        -- nenhuma, passaria limpa e derrubaria o próximo aviso em massa.
        'lote_aguardando_aprovacao',
        'portal_aberto'
    ));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
    check (type in ('approval', 'adjustment', 'publication', 'system', 'lead', 'portal'));

-- ---------------------------------------------------------------------
-- 1.1 As duas chaves da agência
--
-- Ficam em `workspaces` porque são da agência, não da pessoa: o aviso vai
-- para o dono e para os admins, e cada um encontrando um ajuste diferente
-- seria a mesma preferência com duas respostas. É onde
-- `notificacao_aprovacao` já mora, pela mesma razão.
--
-- **Ligadas por padrão**, e as agências que já existem entram ligadas: o
-- default vale para a linha nova, e o `update` abaixo carimba as antigas.
-- Nulo aqui significaria "ninguém decidiu", e a função teria de escolher um
-- lado — escolher "desligado" faria a entrega nascer muda.
--
-- Separadas, e não uma chave só, porque o volume das duas é muito diferente:
-- abrir o portal acontece várias vezes por dia e aprovar acontece uma vez por
-- peça. Quem se cansar do primeiro não quer perder o segundo junto.
-- ---------------------------------------------------------------------
alter table public.workspaces
    add column if not exists avisar_acesso_do_portal boolean not null default true;

alter table public.workspaces
    add column if not exists avisar_acoes_do_cliente boolean not null default true;

-- ---------------------------------------------------------------------
-- 2. O modelo do e-mail de acesso
--
-- `destinatario = 'agencia'`, como o de aprovação e o de ajuste. E ele nasce
-- **ativo**: o pedido era receber o aviso, e um modelo desligado por padrão
-- faria a entrega parecer quebrada. Desligar é um clique em Admin → E-mails,
-- que é onde esse aviso se apaga se virar ruído.
--
-- `on conflict do nothing` porque a migração é repetível e o texto pode já
-- ter sido editado na tela — a edição do dono do produto vale mais que o
-- padrão daqui.
-- ---------------------------------------------------------------------
insert into public.email_templates (evento, nome, descricao, destinatario, assunto, corpo) values
('portal_aberto',
 'Cliente abriu o portal',
 'Enviado à agência quando alguém do cliente abre o portal.',
 'agencia',
 '{{cliente}} abriu o portal',
 E'Olá, {{agencia}}\n\n{{cliente}} acabou de abrir o portal do cliente.\n\nSe havia conteúdo aguardando aprovação, é uma boa hora para acompanhar.')
on conflict (evento) do nothing;

-- ---------------------------------------------------------------------
-- 3. Para quem vai o aviso da agência
--
-- Dono **e** admins ativos, um e-mail por pessoa. A agência em que quem
-- administra não é quem criou a conta é o caso comum: avisar só o `owner`
-- deixaria o aviso chegando a quem não abre o produto.
--
-- `security definer` porque `auth.users` não é legível por sessão nenhuma —
-- é o mesmo motivo de `equipe_da_agencia` existir. Fica em `private`, que não
-- concede `USAGE`, então não há como chamá-la do PostgREST para colher
-- e-mails de agência alheia.
--
-- Uma coluna `email` em `workspace_members` seria mais simples e está errada
-- pela razão já registrada: o e-mail é a credencial de login, e uma cópia
-- envelhece em silêncio no dia em que alguém troca o endereço da conta.
-- ---------------------------------------------------------------------
create or replace function private.destinatarios_da_agencia(p_workspace_id uuid)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
    select distinct lower(trim(u.email))
      from public.workspace_members m
      join auth.users u on u.id = m.user_id
     where m.workspace_id = p_workspace_id
       and m.role in ('owner', 'admin')
       and m.ativo
       and coalesce(trim(u.email), '') <> '';
$$;

-- ---------------------------------------------------------------------
-- 4. Enfileirar o e-mail de um evento disparado pelo portal
--
-- Não lança em nenhum caminho, e isso é regra: ela é efeito colateral de uma
-- ação do cliente que **já deu certo**. Um modelo desligado ou uma agência
-- sem admin com e-mail não podem fazer `portal_aprovar` devolver `false` —
-- a peça foi aprovada, e dizer o contrário ao cliente seria pior que não
-- avisar a agência.
-- ---------------------------------------------------------------------
create or replace function private.enfileirar_email_do_portal(
    p_workspace_id uuid,
    p_evento text,
    p_job_id uuid,
    p_client_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    modelo public.email_templates;
    agencia public.workspaces;
    destino text;
begin
    select * into agencia from public.workspaces where id = p_workspace_id;

    /*
      **A chave da agência é conferida aqui, e não em quem dispara.**

      É a mesma decisão de `enfileirarEmail` conferir `notificacao_aprovacao`
      em vez de cada tela conferir: o evento sai de vários lugares —
      `portal_aprovar`, `portal_pedir_ajuste`, `portal_registrar_acesso` —, e
      filtrar em cada um garante esquecer um. Esquecer aqui é o pior caso: a
      agência desliga o aviso na tela e continua recebendo, e a preferência
      vira enfeite.
    */
    if p_evento = 'portal_aberto' and not coalesce(agencia.avisar_acesso_do_portal, true) then
        return;
    end if;

    if p_evento in ('conteudo_aprovado', 'pedido_de_ajuste')
       and not coalesce(agencia.avisar_acoes_do_cliente, true) then
        return;
    end if;

    select * into modelo from public.email_templates where evento = p_evento;

    -- Sem modelo, ou desligado na tela do Super Admin: é a resposta certa, e
    -- não vale ocupar a fila com o que não vai sair.
    if modelo.evento is null or not modelo.ativo then
        return;
    end if;

    if modelo.destinatario = 'cliente' then
        select nullif(trim(c.email), '') into destino
          from public.clients c where c.id = p_client_id;
        if destino is not null then
            insert into public.email_queue (workspace_id, evento, job_id, client_id, destinatario)
            values (p_workspace_id, p_evento, p_job_id, p_client_id, destino);
        end if;
        return;
    end if;

    for destino in select * from private.destinatarios_da_agencia(p_workspace_id) loop
        insert into public.email_queue (workspace_id, evento, job_id, client_id, destinatario)
        values (p_workspace_id, p_evento, p_job_id, p_client_id, destino);
    end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. O cliente abriu o portal
--
-- **Uma linha por visita, sem janela de silêncio** — foi a decisão tomada.
-- Vale registrar o risco junto, porque ele já custou caro uma vez neste
-- produto: dez peças enviadas numa segunda viraram dez e-mails em quinze
-- minutos, e o efeito não foi o cliente ficar bem informado, foi ele parar
-- de abrir todos. Aqui o volume é `visitas × admins`. Se virar ruído, o
-- desligamento é o modelo em Admin → E-mails, e a janela de silêncio entra
-- nesta função, num lugar só.
--
-- "Visita" é a abertura do portal com sessão válida, uma chamada por
-- montagem da tela — não por render e não por troca de aba lá dentro. O
-- recorte é do front, e é o único jeito: `portal_dados` é `stable` e não
-- pode escrever, e ancorar no login avisaria uma vez por mês, porque a
-- sessão do portal dura 30 dias.
--
-- `ultimo_acesso` passa a ser carimbado aqui também. Ele só marcava o login,
-- então a ficha do cliente dizia "último acesso há 29 dias" de quem entra
-- todo dia: uma data verdadeira medindo a coisa errada.
-- ---------------------------------------------------------------------
create or replace function public.portal_registrar_acesso(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    usuario public.client_users;
    cliente public.clients;
    quem text;
begin
    usuario := private.portal_usuario(p_token);
    if usuario.id is null then
        return false;
    end if;

    select * into cliente from public.clients where id = usuario.client_id;
    if cliente.id is null then
        return false;
    end if;

    quem := coalesce(nullif(trim(usuario.name), ''), usuario.email);

    -- `ultimo_acesso` é carimbado **antes** da chave, e de propósito: ele não
    -- é aviso, é o fato. A ficha do cliente continua sabendo quando aquela
    -- pessoa entrou mesmo com a agência tendo desligado a notificação.
    update public.client_users set ultimo_acesso = now() where id = usuario.id;

    -- Aqui a chave vale para o painel também. É a diferença em relação a
    -- aprovar e pedir ajuste, cuja notificação continua sempre: aquilo é
    -- decisão do cliente sobre a peça, e perdê-la é perder trabalho. Isto é
    -- presença, e quem desligou o aviso desligou porque não quer vê-lo.
    if not coalesce(
        (select w.avisar_acesso_do_portal from public.workspaces w where w.id = cliente.workspace_id),
        true
    ) then
        return true;
    end if;

    insert into public.notifications (workspace_id, title, message, type, read, link_context)
    values (
        cliente.workspace_id,
        'Cliente no portal 👀',
        quem || ' abriu o portal de ' || cliente.name || '.',
        'portal',
        false,
        jsonb_build_object('tab', 'clientes', 'clientId', cliente.id)
    );

    perform private.enfileirar_email_do_portal(
        cliente.workspace_id, 'portal_aberto', null, cliente.id
    );

    return true;
end;
$$;

-- O portal é anônimo: quem chega ali não tem sessão do Supabase Auth. O
-- token é a credencial, e é ele que a função confere antes de escrever.
grant execute on function public.portal_registrar_acesso(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Aprovar e pedir ajuste passam a enfileirar o e-mail
--
-- As duas funções são repetidas **por inteiro** a partir de
-- 20260910160000_usuarios_do_cliente.sql — `create or replace` substitui, não
-- emenda. O que muda em cada uma é a chamada de `enfileirar_email_do_portal`
-- no fim, depois de a gravação ter dado certo.
--
-- E o `tab` do pedido de ajuste sai de `'conteudos'`, que **não existe** em
-- `TabType` desde sempre: clicar naquele aviso não levava a lugar nenhum. A
-- tela do quadro é `'producao'`.
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

    perform private.enfileirar_email_do_portal(
        job.workspace_id, 'conteudo_aprovado', job.id, job.client_id
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
        jsonb_build_object('tab', 'producao', 'jobId', job.id, 'clientId', job.client_id)
    );

    -- O `last_feedback` já está gravado acima, e é de lá que o modelo tira
    -- `{{feedback}}` na hora de enviar. Enfileirar antes do update mandaria
    -- o texto do pedido anterior.
    perform private.enfileirar_email_do_portal(
        job.workspace_id, 'pedido_de_ajuste', job.id, job.client_id
    );

    return true;
end;
$$;

grant execute on function public.portal_aprovar(text, uuid, text) to anon, authenticated;
grant execute on function public.portal_pedir_ajuste(text, uuid, text, text) to anon, authenticated;
