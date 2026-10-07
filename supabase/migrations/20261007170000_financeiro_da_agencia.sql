-- =====================================================================
-- O Financeiro da agência: o que entra, o que sai, e de qual caixa.
--
-- O produto media o trabalho (Relatórios) e a venda (Comercial), e não media
-- **dinheiro da agência**. A permissão `ver_financeiro` existia em
-- `permissions.ts` desde o começo, com o papel `financial` — e sem nenhuma
-- tela atrás dela: a família do `trial_ends_at`, um nome que parece uma
-- regra e não é.
--
-- Duas tabelas, e nenhuma a mais:
--
--   financeiro_caixas       onde o dinheiro fica (conta, carteira, cofre)
--   financeiro_lancamentos  o que se tem a receber e a pagar
--
-- ### Não existe tabela de movimentação de caixa, e isso é decisão
--
-- A tela de Caixa oferece "Entrada" e "Saída" avulsas — e as duas gravam um
-- **lançamento já liquidado** naquele caixa, em vez de uma linha num segundo
-- lugar. Duas tabelas respondendo "quanto entrou este mês" divergem na
-- primeira pressa, e divergir aqui é pior que no resto do produto: o relatório
-- passa a somar uma delas e o saldo do caixa a outra, com as duas telas certas
-- cada uma pelo seu lado. O saldo é `saldo_inicial + liquidados do caixa`, e
-- é a **mesma** soma que o relatório faz.
--
-- ### Centavos inteiros, nunca `numeric` nem ponto flutuante
--
-- O valor chega ao JavaScript como `number`, e `0.1 + 0.2` ali é
-- `0.30000000000000004`. Num campo de dinheiro isso é um centavo de diferença
-- por soma — invisível numa linha, visível no fechamento do mês, e sem jeito
-- de explicar para quem lê. Inteiro em centavos não arredonda nunca; a
-- divisão por 100 acontece na hora de **mostrar**, uma vez.
--
-- ### `vencimento` e `liquidado_em` são `date`, não `timestamptz`
--
-- Conta vence num dia, não num instante: convertê-la por fuso a moveria um
-- dia para quem abrir a tela de outro estado — que é a armadilha 8.2 na tela
-- onde ela custa mais caro. Tipo `date` tira a conversão do caminho.
--
-- E `liquidado_em` é **data, não booleano**: "pago" sem quando não responde
-- a pergunta que separa competência de caixa (*a conta de setembro foi paga
-- em outubro*), que é a razão de o relatório existir.
-- =====================================================================

create table if not exists public.financeiro_caixas (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    nome text not null,
    -- O que já havia na conta quando a agência começou a usar o produto. Sem
    -- ele, o saldo começaria em zero e a tela afirmaria um valor que não é o
    -- da conta de verdade.
    saldo_inicial_centavos bigint not null default 0,
    arquivado boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists financeiro_caixas_workspace_idx
    on public.financeiro_caixas (workspace_id);

create table if not exists public.financeiro_lancamentos (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    tipo text not null check (tipo in ('receber', 'pagar')),
    descricao text not null,
    categoria text,
    /*
      O cliente é opcional, e o `set null` é o ponto: apagar um cliente não
      pode apagar o histórico de quanto ele pagou. O nome fica em
      `contraparte`, que é também onde mora o fornecedor — do lado de pagar
      não há tabela de fornecedor, e inventar uma para guardar um nome seria
      uma coleção a mais na carga por nada.
    */
    client_id uuid references public.clients(id) on delete set null,
    contraparte text,
    valor_centavos bigint not null check (valor_centavos > 0),
    vencimento date not null,
    /** Nulo é "em aberto". Preenchido é o dia em que o dinheiro andou. */
    liquidado_em date,
    caixa_id uuid references public.financeiro_caixas(id) on delete set null,
    observacao text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists financeiro_lancamentos_workspace_idx
    on public.financeiro_lancamentos (workspace_id, vencimento);

-- A tela de Caixa lista o que foi liquidado em cada um, e o saldo sai dessa
-- mesma soma.
create index if not exists financeiro_lancamentos_caixa_idx
    on public.financeiro_lancamentos (caixa_id, liquidado_em);

create or replace function private.carimbar_atualizacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists financeiro_lancamentos_carimbar on public.financeiro_lancamentos;
create trigger financeiro_lancamentos_carimbar
    before update on public.financeiro_lancamentos
    for each row
    execute function private.carimbar_atualizacao();

alter table public.financeiro_caixas       enable row level security;
alter table public.financeiro_lancamentos  enable row level security;

/*
  **Quem recorta é a RLS, não o menu.**

  O dinheiro da agência — o que ela cobra, o que ela paga, quanto sobra — não
  é da equipe inteira: designer, copywriter e social media não o veem, e
  esconder o menu deixando a tabela legível seria a armadilha 9 com a conta
  bancária dentro. `ver_financeiro` já nomeava esses três papéis em
  `permissions.ts`; aqui eles viram política.

  Leitura e escrita têm a **mesma** lista de propósito: não existe aqui o caso
  de "vê e não mexe" — quem é do financeiro lança, e quem não é não lê.
*/
drop policy if exists "financeiro le caixas" on public.financeiro_caixas;
create policy "financeiro le caixas"
    on public.financeiro_caixas for select
    to authenticated
    using ((select private.papel_na_agencia(workspace_id)) in ('owner', 'admin', 'financial'));

drop policy if exists "financeiro gerencia caixas" on public.financeiro_caixas;
create policy "financeiro gerencia caixas"
    on public.financeiro_caixas for all
    to authenticated
    using ((select private.papel_na_agencia(workspace_id)) in ('owner', 'admin', 'financial'))
    with check ((select private.papel_na_agencia(workspace_id)) in ('owner', 'admin', 'financial'));

drop policy if exists "financeiro le lancamentos" on public.financeiro_lancamentos;
create policy "financeiro le lancamentos"
    on public.financeiro_lancamentos for select
    to authenticated
    using ((select private.papel_na_agencia(workspace_id)) in ('owner', 'admin', 'financial'));

drop policy if exists "financeiro gerencia lancamentos" on public.financeiro_lancamentos;
create policy "financeiro gerencia lancamentos"
    on public.financeiro_lancamentos for all
    to authenticated
    using ((select private.papel_na_agencia(workspace_id)) in ('owner', 'admin', 'financial'))
    with check ((select private.papel_na_agencia(workspace_id)) in ('owner', 'admin', 'financial'));
