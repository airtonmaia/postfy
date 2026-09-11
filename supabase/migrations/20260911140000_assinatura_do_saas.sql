-- =====================================================================
-- Assinatura da agência com o Orquesia.
--
-- Até aqui não existia: `AdminFinanceiro` dizia isso em texto, e dizia bem —
-- sem registro de cobrança, qualquer número ali era chute (armadilha 9). E
-- `workspaces.trial_ends_at` existia no schema com **ninguém lendo**: o teste
-- grátis nunca terminava.
--
-- Cuidado com o nome: `plans` é outra coisa. É o catálogo que cada agência
-- monta para os clientes **dela**. Esta tabela é a relação da agência com o
-- produto — uma linha por agência, e o Stripe é a fonte da verdade.
--
-- Por isso **não há política de escrita para sessão autenticada**. Quem
-- escreve é o webhook do Stripe, com a chave de serviço. Uma política de
-- update aqui deixaria qualquer dono de agência marcar a própria assinatura
-- como ativa — que é exatamente o buraco que a tabela existe para fechar.
-- =====================================================================

create table if not exists public.subscriptions (
    workspace_id uuid primary key references public.workspaces(id) on delete cascade,

    -- Ids do Stripe. Únicos porque um cliente/assinatura de lá pertence a uma
    -- agência só; duas linhas apontando para a mesma assinatura significaria
    -- cobrança contada em dobro no Financeiro.
    stripe_customer_id text unique,
    stripe_subscription_id text unique,

    -- O vocabulário do Stripe é mais fino que o que a tela precisa
    -- (`incomplete`, `past_due`, `unpaid`, `paused`…). Aqui ficam os quatro
    -- estados que mudam o que a pessoa pode fazer.
    status text not null default 'teste'
        check (status in ('teste', 'ativa', 'inadimplente', 'cancelada')),

    -- Congelados do Stripe no webhook: o Financeiro soma isto sem precisar
    -- chamar a API deles a cada abertura de tela.
    plano text,
    preco_centavos int,
    moeda text not null default 'brl',

    -- Até quando está pago. É o que o app compara para liberar ou bloquear.
    periodo_fim timestamptz,
    cancelar_no_fim boolean not null default false,

    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create index if not exists subscriptions_status_idx on public.subscriptions (status);

alter table public.subscriptions enable row level security;

-- A agência vê a própria assinatura: é o que a tela de cobrança dela mostra.
drop policy if exists "membro le a assinatura da agencia" on public.subscriptions;
create policy "membro le a assinatura da agencia"
    on public.subscriptions for select
    to authenticated
    using ((select private.e_membro(workspace_id)));

-- O dono do produto vê todas: é o Financeiro do /admin.
drop policy if exists "admin da plataforma le todas as assinaturas" on public.subscriptions;
create policy "admin da plataforma le todas as assinaturas"
    on public.subscriptions for select
    to authenticated
    using ((select private.eh_admin_da_plataforma()));

-- ---------------------------------------------------------------------
-- "Esta agência pode usar o produto?"
--
-- Uma pergunta, um lugar. Sem isto, cada tela responderia por conta própria
-- e alguma delas esqueceria o caso da assinatura vencida ontem.
--
-- Agência sem linha em `subscriptions` é agência que nunca passou pelo
-- checkout: vale o teste, pelo `trial_ends_at` do workspace. Sem data de
-- fim, o teste é aberto — é o estado de quem foi criado antes disto existir,
-- e derrubar essas agências de uma vez seria pior que a falta de cobrança.
-- ---------------------------------------------------------------------
create or replace function public.acesso_da_agencia(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    ws public.workspaces;
    assinatura public.subscriptions;
    liberado boolean;
    motivo text;
begin
    if not private.e_membro(p_workspace_id) and not private.eh_admin_da_plataforma() then
        raise exception 'Sem acesso a esta agência.' using errcode = '42501';
    end if;

    select * into ws from public.workspaces where id = p_workspace_id;
    if ws.id is null then
        raise exception 'Agência não encontrada.' using errcode = 'P0002';
    end if;

    select * into assinatura from public.subscriptions where workspace_id = p_workspace_id;

    if assinatura.workspace_id is null then
        liberado := ws.trial_ends_at is null or ws.trial_ends_at > now();
        motivo := case when liberado then 'teste' else 'teste_vencido' end;
    elsif assinatura.status = 'ativa' then
        -- `periodo_fim` no passado com status ativa acontece na janela entre
        -- o vencimento e o webhook da renovação chegar. Um dia de folga
        -- evita derrubar quem está em dia por causa de latência do Stripe.
        liberado := assinatura.periodo_fim is null
                 or assinatura.periodo_fim > now() - interval '1 day';
        motivo := case when liberado then 'ativa' else 'vencida' end;
    elsif assinatura.status = 'inadimplente' then
        -- Continua usando enquanto o Stripe tenta cobrar de novo. Cortar no
        -- primeiro cartão recusado perde cliente que só trocou de cartão.
        liberado := assinatura.periodo_fim is null
                 or assinatura.periodo_fim > now() - interval '7 days';
        motivo := 'inadimplente';
    elsif assinatura.status = 'teste' then
        liberado := ws.trial_ends_at is null or ws.trial_ends_at > now();
        motivo := case when liberado then 'teste' else 'teste_vencido' end;
    else
        liberado := false;
        motivo := 'cancelada';
    end if;

    return jsonb_build_object(
        'liberado', liberado,
        'motivo', motivo,
        'status', coalesce(assinatura.status, 'teste'),
        'plano', assinatura.plano,
        'preco_centavos', assinatura.preco_centavos,
        'moeda', coalesce(assinatura.moeda, 'brl'),
        'periodo_fim', assinatura.periodo_fim,
        'cancelar_no_fim', coalesce(assinatura.cancelar_no_fim, false),
        'teste_termina_em', ws.trial_ends_at,
        'tem_assinatura', assinatura.workspace_id is not null
    );
end;
$$;

revoke all on function public.acesso_da_agencia(uuid) from public, anon;
grant execute on function public.acesso_da_agencia(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Os números de cobrança do produto inteiro, para o Financeiro do /admin.
--
-- Só contagem e soma, como `admin_numeros_do_saas`: nenhum nome, e-mail ou
-- id do Stripe. O dono do SaaS vê quanto entra sem ler o cadastro de
-- ninguém.
-- ---------------------------------------------------------------------
create or replace function public.admin_numeros_de_cobranca()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if not private.eh_admin_da_plataforma() then
        raise exception 'Apenas administradores da plataforma.' using errcode = '42501';
    end if;

    return jsonb_build_object(
        -- MRR de verdade: soma do que está assinado e ativo, em centavos.
        -- Não é agências × preço de tabela — era isso que dizia R$ 591,00
        -- num dia de R$ 0,00.
        'mrr_centavos', coalesce((
            select sum(preco_centavos) from public.subscriptions
             where status = 'ativa' and preco_centavos is not null
        ), 0),
        'assinaturas', jsonb_build_object(
            'ativas', (select count(*) from public.subscriptions where status = 'ativa'),
            'inadimplentes', (select count(*) from public.subscriptions where status = 'inadimplente'),
            'canceladas', (select count(*) from public.subscriptions where status = 'cancelada'),
            'cancelam_no_fim', (select count(*) from public.subscriptions
                                 where cancelar_no_fim and status = 'ativa')
        ),
        'agencias', jsonb_build_object(
            'total', (select count(*) from public.workspaces where deleted_at is null),
            'sem_assinatura', (select count(*) from public.workspaces w
                                where w.deleted_at is null
                                  and not exists (select 1 from public.subscriptions s
                                                   where s.workspace_id = w.id)),
            'teste_vencido', (select count(*) from public.workspaces w
                               where w.deleted_at is null
                                 and w.trial_ends_at is not null
                                 and w.trial_ends_at < now()
                                 and not exists (select 1 from public.subscriptions s
                                                  where s.workspace_id = w.id
                                                    and s.status = 'ativa'))
        ),
        'apurado_em', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')
    );
end;
$$;

revoke all on function public.admin_numeros_de_cobranca() from public, anon;
grant execute on function public.admin_numeros_de_cobranca() to authenticated;
