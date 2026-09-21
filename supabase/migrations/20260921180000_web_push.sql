-- =====================================================================
-- Web Push: o aviso alcança quem não está com o Orquesia aberto.
--
-- O sino já mostra tudo o que interessa, e sonda de minuto em minuto — mas
-- só enquanto a aba existe. O caso que importa é o contrário: o cliente
-- aprova às 22h de domingo, e a agência descobre na segunda de manhã.
--
-- Duas peças aqui: onde mora a inscrição do dispositivo, e como o cron sabe
-- o que ainda não foi empurrado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. A inscrição do dispositivo
--
-- Uma linha por navegador, não por pessoa: quem usa o computador e o celular
-- tem duas, e as duas precisam receber. É o que o `unique (user_id,
-- endpoint)` diz — reinscrever o mesmo navegador atualiza, não duplica.
--
-- **Não há `workspace_id` aqui, e isso é diferente do plano que originou
-- esta entrega.** Guardar a agência na inscrição criaria um buraco: a
-- política de RLS natural é `auth.uid() = user_id`, e com ela qualquer
-- pessoa gravaria uma linha com o `workspace_id` de **outra** agência e
-- passaria a receber os avisos dela. Quem decide para quem um aviso vai é
-- `workspace_members`, que é a tabela que já responde isso — e ela é lida
-- no envio, pela chave de serviço.
--
-- A inscrição não é segredo, mas também não é pública: o par
-- `endpoint`/`auth` é o que permite **enviar** notificação para aquele
-- navegador. Por isso a RLS é por dono, e nenhuma política de leitura
-- alheia existe.
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    -- A URL que o serviço de push do navegador dá. É ela que identifica o
    -- aparelho, e é ela que devolve 404/410 quando a inscrição morre.
    endpoint text not null,
    p256dh text not null,
    auth_key text not null,
    -- Só para a pessoa reconhecer qual aparelho é qual na hora de remover.
    user_agent text,
    created_at timestamptz not null default now(),
    ultimo_envio_em timestamptz,
    unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "dono gerencia os proprios dispositivos" on public.push_subscriptions;
create policy "dono gerencia os proprios dispositivos"
    on public.push_subscriptions for all
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- 2. O que ainda não foi empurrado
--
-- Não há fila separada, e isso é decisão. A fila de e-mail existe porque um
-- e-mail tem destinatário congelado, três tentativas e um erro que vale ler
-- depois. Push é o oposto: ele é efêmero — um aviso que chega cinco minutos
-- atrasado ainda serve, um que chega no dia seguinte não serve para nada —,
-- e o destinatário é derivado na hora, de `workspace_members`.
--
-- Então a própria `notifications` carrega a marca. Uma coluna, um índice
-- parcial, e o leque de dispositivos é aberto no envio.
--
-- **`push_enviado_em` avança mesmo quando o envio falha**, pela mesma razão
-- que `post_metrics.medido_em` avança: a fila é ordenada por ele, e sem
-- avançar a linha quebrada é tentada em toda passada e segura todas as
-- outras atrás dela — a entrega para sem dar erro visível.
-- ---------------------------------------------------------------------
alter table public.notifications
    add column if not exists push_enviado_em timestamptz;

create index if not exists notifications_push_pendente_idx
    on public.notifications (created_at)
    where push_enviado_em is null;

-- ---------------------------------------------------------------------
-- 3. O acervo nasce marcado como enviado
--
-- Sem esta linha, a primeira passada do cron empurraria **toda notificação
-- que a agência já tem** — dezenas de avisos de uma vez, todos velhos, no
-- celular de todo mundo. É o oposto do backfill que `post_metrics` faz de
-- propósito: lá o histórico é o valor; aqui ele é ruído, e ruído logo na
-- estreia é o que faz a pessoa desligar a permissão e não voltar.
--
-- `where push_enviado_em is null` deixa a migração repetível: rodar de novo
-- não carimba o que entrou depois.
-- ---------------------------------------------------------------------
update public.notifications
   set push_enviado_em = now()
 where push_enviado_em is null;
