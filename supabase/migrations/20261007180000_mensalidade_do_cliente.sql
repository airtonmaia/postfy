-- =====================================================================
-- A mensalidade do cliente vira conta a receber — uma vez por mês, e só uma.
--
-- O cadastro do cliente já guarda o que ele paga (`clients.services`, somado
-- como "Investimento mensal" na tela de Clientes). Pedir para digitar o mesmo
-- número de novo todo mês no Financeiro é o caminho mais curto para os dois
-- divergirem: o contrato sobe para R$ 2.500 na ficha e o financeiro continua
-- cobrando R$ 2.000, sem nada acusando.
--
-- ### `mensalidade_de` é a competência, e é ela que impede a cobrança dobrada
--
-- Gerar as mensalidades é um **clique**, não um efeito — postagem e cobrança
-- são as duas coisas deste produto que não voltam. E clique repetido acontece:
-- duas pessoas da agência no mesmo dia, ou a mesma pessoa que não lembra se já
-- fez. Sem marca no banco, a segunda rodada duplicaria a conta de todo mundo.
--
-- A marca é o mês de competência (`2026-10`), e quem recusa o repetido é o
-- **índice único**, não a tela: conferir antes de inserir deixa a janela entre
-- a conferência e a gravação, que é exatamente onde dois cliques simultâneos
-- se encontram. É a mesma decisão do `unique (job_id, connection_id)` da
-- `publish_queue`, pelo mesmo motivo.
--
-- O índice é **parcial**: lançamento digitado à mão não tem competência, e
-- nada impede dois lançamentos avulsos do mesmo cliente no mesmo mês — dois
-- serviços extras existem.
-- =====================================================================

alter table public.financeiro_lancamentos
    add column if not exists mensalidade_de text;

-- `YYYY-MM`, e o formato é conferido no banco: a tela compõe esse texto, e um
-- `2026-9` entraria sem reclamar e nunca casaria com o `2026-09` do mês
-- seguinte — a cobrança dobraria sem ninguém ver.
alter table public.financeiro_lancamentos
    drop constraint if exists financeiro_mensalidade_formato;
alter table public.financeiro_lancamentos
    add constraint financeiro_mensalidade_formato
    check (mensalidade_de is null or mensalidade_de ~ '^\d{4}-\d{2}$');

create unique index if not exists financeiro_mensalidade_unica
    on public.financeiro_lancamentos (workspace_id, client_id, mensalidade_de)
    where mensalidade_de is not null;
