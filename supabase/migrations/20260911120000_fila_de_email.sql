-- =====================================================================
-- Fila de e-mail: o envio deixa de depender da aba ficar aberta.
--
-- Até aqui, `dispararAutomacoes` chamava `/api/send-email` do navegador,
-- depois de a mudança já estar gravada. Quem aprovava um conteúdo e fechava
-- a aba no mesmo segundo interrompia o envio — o job ficava aprovado e o
-- e-mail não saía, sem erro em lugar nenhum.
--
-- Agora o navegador só **enfileira**, que é um insert e acaba antes de a aba
-- fechar. Quem envia é o cron que já roda de 5 em 5 minutos para publicar
-- (`api/publicar.ts`), com a chave de serviço.
--
-- Por que não um gatilho no Postgres chamando a função por `pg_net`, que era
-- o plano antigo: quem decide se o e-mail sai é a regra de automação
-- (`automations.action_type = 'email'`), lógica que já existe e é testada em
-- `tests/automacoes.test.ts`. Reescrevê-la em plpgsql só criaria uma segunda
-- verdade para a mesma pergunta.
--
-- Por que não uma rota nova para o cron chamar: o plano Hobby da Vercel
-- aceita 12 funções e já estamos em 12. Ver a armadilha 6.
-- =====================================================================

create table if not exists public.email_queue (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    evento text not null check (evento in (
        'conteudo_aguardando_aprovacao',
        'conteudo_aprovado',
        'pedido_de_ajuste'
    )),
    job_id uuid not null references public.jobs(id) on delete cascade,
    -- Para quem, resolvido por quem enfileirou.
    --
    -- O modelo diz se vai para o cliente ou para a agência; quando é para a
    -- agência, o destino é quem estava na sessão. O cron não tem sessão para
    -- perguntar isso depois, então a resposta é congelada aqui.
    destinatario text not null,
    status text not null default 'pendente'
        check (status in ('pendente', 'enviado', 'falhou')),
    -- Três tentativas e para. Sem limite, um endereço inválido seria
    -- retentado a cada 5 minutos para sempre, e a fila nunca esvaziaria.
    tentativas int not null default 0,
    erro text,
    created_at timestamptz not null default now(),
    enviado_em timestamptz
);

-- O cron pergunta exatamente isto: "o que está pendente e ainda tem
-- tentativa?". Índice parcial — pendente é a minoria depois de um dia.
create index if not exists email_queue_pendentes_idx
    on public.email_queue (created_at)
    where status = 'pendente';

alter table public.email_queue enable row level security;

-- A agência enxerga a própria fila: é o que responde "o e-mail saiu?" sem
-- precisar de acesso ao log do servidor.
drop policy if exists "membro le a fila da agencia" on public.email_queue;
create policy "membro le a fila da agencia"
    on public.email_queue for select
    to authenticated
    using ((select private.e_membro(workspace_id)));

drop policy if exists "membro enfileira na propria agencia" on public.email_queue;
create policy "membro enfileira na propria agencia"
    on public.email_queue for insert
    to authenticated
    with check ((select private.e_membro(workspace_id)));

-- Sem update e sem delete para sessão autenticada, de propósito: quem marca
-- como enviado é o cron, com a chave de serviço. Uma política de update aqui
-- deixaria o navegador dizer "já enviei" sobre um e-mail que nunca saiu.
