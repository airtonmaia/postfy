-- ---------------------------------------------------------------------
-- Administradores da plataforma (dono do SaaS)
--
-- "Ser dono da plataforma" e "ser dono de uma agência" eram a mesma coisa no
-- código: a permissão `gerenciar_saas` estava no papel `owner`, e a RPC
-- criar_agencia dá esse papel a todo mundo que se cadastra. Na prática, todo
-- cliente que criava conta enxergava o menu de gestão do SaaS.
--
-- Os dados não vazavam, porque a RLS recorta por agência. Mas a intenção
-- estava errada, e bastava alguém acrescentar uma política mais frouxa para
-- virar vazamento de verdade.
--
-- São eixos diferentes: o papel diz o que você faz DENTRO de uma agência;
-- esta tabela diz quem administra o produto. Por isso ela é uma tabela, e
-- não mais um papel — assim dá para conceder e revogar sem tocar em código,
-- e a resposta mora no banco, onde a RLS enxerga.
-- ---------------------------------------------------------------------

create table if not exists public.platform_admins (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    note text
);

alter table public.platform_admins enable row level security;

-- ---------------------------------------------------------------------
-- Helper no schema privado
--
-- Fica em `private` porque nada aqui deve ser chamável pela API pública: é
-- peça de política, não recurso do produto. SECURITY DEFINER com
-- `search_path = ''` para não depender do caminho de quem chama, e para
-- poder ler a tabela sem cair na RLS dela mesma — que causaria recursão.
-- ---------------------------------------------------------------------
create or replace function private.eh_admin_da_plataforma()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.platform_admins
        where user_id = (select auth.uid())
    );
$$;

-- O EXECUTE fica no padrão (público) de propósito, como nos outros helpers
-- daqui. Quem impede a chamada direta é o schema `private`, que não concede
-- USAGE a anon nem a authenticated: sem USAGE ninguém consegue nomear a
-- função, e a API do PostgREST só expõe `public`.
--
-- Revogar o EXECUTE quebra a policy: a expressão guardada resolve a função
-- pelo OID, mas o privilégio de execução é conferido em tempo de execução,
-- como o usuário da sessão. Com o revoke, toda leitura de workspaces passa a
-- falhar com 42501.
grant execute on function private.eh_admin_da_plataforma() to public;

-- A lista de admins só é visível para admins. Não há política de INSERT,
-- UPDATE ou DELETE de propósito: promover alguém a dono do SaaS é operação
-- de banco, feita por quem tem acesso ao projeto — não algo que uma sessão
-- autenticada possa fazer, nem por engano nem por requisição forjada.
drop policy if exists "admin le a lista de admins" on public.platform_admins;
create policy "admin le a lista de admins"
    on public.platform_admins for select
    using (private.eh_admin_da_plataforma());

-- ---------------------------------------------------------------------
-- Acesso do dono do SaaS às agências
--
-- "Lista de Agências" só faz sentido listando todas. A política de leitura
-- existente recorta por participação; esta acrescenta o caso do admin da
-- plataforma, sem afrouxar a primeira.
--
-- É leitura apenas. O dono do SaaS enxerga as agências para administrar
-- planos e cobrança; não passa a poder editar o conteúdo delas.
-- ---------------------------------------------------------------------
drop policy if exists "admin da plataforma le todas as agencias" on public.workspaces;
create policy "admin da plataforma le todas as agencias"
    on public.workspaces for select
    using (private.eh_admin_da_plataforma());
