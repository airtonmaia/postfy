-- =====================================================================
-- Endereço legível para o cliente no link do portal.
--
-- A prévia abria com `?cliente=3a0be2a4-553a-4098-b047-9f1c609abe3f`. Ninguém
-- lê isso, ninguém confere se é o cliente certo antes de abrir, e num print
-- ou numa conversa o link não diz nada.
--
-- O slug é por agência, não global: duas agências podem ter um cliente
-- chamado "Padaria do João", e uma não deveria saber da existência da outra
-- pelo endereço que ganhou sufixo.
-- =====================================================================

alter table public.clients add column if not exists slug text;

-- ---------------------------------------------------------------------
-- Geração do slug, sem colisão dentro da agência.
--
-- Mesma normalização de `criar_agencia`: sem acento, sem símbolo, e sufixo
-- numérico quando já existe.
-- ---------------------------------------------------------------------
create or replace function private.slug_do_cliente(
    p_workspace uuid,
    p_nome text,
    p_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    base text;
    tentativa text;
    sufixo int := 0;
begin
    base := regexp_replace(
        lower(public.unaccent_simples(trim(coalesce(p_nome, '')))),
        '[^a-z0-9]+', '-', 'g'
    );
    base := trim(both '-' from base);
    if length(base) = 0 then
        base := 'cliente';
    end if;
    base := left(base, 60);

    tentativa := base;
    -- `p_id` fica de fora da checagem: renomear um cliente sem mudar o nome
    -- não pode fazer ele colidir consigo mesmo e ganhar sufixo à toa.
    while exists (
        select 1 from public.clients c
         where c.workspace_id = p_workspace
           and c.slug = tentativa
           and (p_id is null or c.id <> p_id)
    ) loop
        sufixo := sufixo + 1;
        tentativa := left(base, 60) || '-' || sufixo::text;
    end loop;

    return tentativa;
end;
$$;

-- ---------------------------------------------------------------------
-- O slug acompanha o nome.
--
-- Em trigger, e não no app: o cliente é criado pela camada de diff do
-- PostfyContext, que não conhece regra de negócio nenhuma. Deixar isso no
-- cliente significaria lembrar de gerar o slug em cada lugar que cria ou
-- renomeia — e é exatamente o tipo de coisa que alguém esquece.
-- ---------------------------------------------------------------------
create or replace function private.manter_slug_do_cliente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' or new.name is distinct from old.name or new.slug is null then
        new.slug := private.slug_do_cliente(new.workspace_id, new.name, new.id);
    end if;
    return new;
end;
$$;

drop trigger if exists cliente_slug on public.clients;
create trigger cliente_slug
    before insert or update on public.clients
    for each row execute function private.manter_slug_do_cliente();

-- Quem já existe ganha o slug agora. Sem `order by`, dois clientes de mesmo
-- nome pegariam o sufixo em ordem imprevisível a cada execução.
do $$
declare linha record;
begin
    for linha in
        select id, workspace_id, name from public.clients
         where slug is null order by created_at
    loop
        update public.clients
           set slug = private.slug_do_cliente(linha.workspace_id, linha.name, linha.id)
         where id = linha.id;
    end loop;
end $$;

alter table public.clients alter column slug set not null;

create unique index if not exists clients_slug_por_agencia
    on public.clients (workspace_id, slug);
