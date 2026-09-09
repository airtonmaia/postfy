-- ---------------------------------------------------------------------
-- Automações que de fato executam
--
-- `trigger` e `action` eram texto livre — descreviam a regra em português
-- para alguém ler, e nada no código as executava. A tela mostrava
-- "12 execuções registradas" de um contador que ninguém incrementava.
--
-- As colunas de texto continuam, porque é o que aparece na interface. O que
-- entra são as versões tipadas, que o motor consegue casar.
--
-- São nullable de propósito: as linhas que já existem não têm evento e
-- simplesmente não disparam, em vez de a migração inventar um gatilho para
-- elas.
-- ---------------------------------------------------------------------
alter table public.automations
    add column if not exists trigger_event text,
    add column if not exists action_type text,
    add column if not exists action_config jsonb not null default '{}'::jsonb;

do $$
begin
    -- O check protege contra gatilho digitado errado virar automação que
    -- nunca dispara e ninguém entende por quê.
    if not exists (
        select 1 from pg_constraint where conname = 'automations_trigger_event_valido'
    ) then
        alter table public.automations add constraint automations_trigger_event_valido
            check (trigger_event is null or trigger_event in (
                'conteudo_aguardando_aprovacao', 'conteudo_aprovado', 'pedido_de_ajuste'
            ));
    end if;

    if not exists (
        select 1 from pg_constraint where conname = 'automations_action_type_valido'
    ) then
        alter table public.automations add constraint automations_action_type_valido
            check (action_type is null or action_type in ('email', 'webhook'));
    end if;
end $$;

-- Parcial: o motor só consulta as ligadas.
create index if not exists automations_gatilho_idx
    on public.automations (workspace_id, trigger_event) where enabled;
