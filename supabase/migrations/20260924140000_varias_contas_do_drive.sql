-- ---------------------------------------------------------------------
-- Mais de uma conta do Google Drive por agência
--
-- `drive_da_agencia` tinha `workspace_id` como chave primária: uma conta por
-- agência, e ponto. Mas uma agência tem o Drive dela e, com frequência, o
-- Drive do cliente — e quem monta a peça precisa escolher de onde buscar
-- **antes** de abrir o seletor.
--
-- ### As tabelas velhas não são apagadas aqui, e isso é a regra
--
-- A `main` é o que está no ar: o código publicado ainda lê
-- `drive_da_agencia` e `drive_credenciais`. Um `drop` aqui derrubaria o
-- produto entre esta migração e o deploy. Elas ficam, sem leitor novo, e
-- saem numa entrega posterior — quando o código que as lia já não estiver
-- publicado.
--
-- ### O que muda de desenho
--
-- A credencial passa a pertencer à **conta**, não à agência. É a mesma
-- divisão de `social_connections` e `social_tokens`: o que a tela mostra é
-- alcançável pela agência; o `refresh_token` não é alcançável por sessão
-- nenhuma.
-- ---------------------------------------------------------------------

create table if not exists public.drive_contas (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    -- De quem é a conta. É o que a pessoa lê para escolher entre duas, então
    -- ele também é o que impede a mesma conta de entrar duas vezes.
    email text,
    conectado_por uuid,
    conectado_em timestamptz not null default now()
);

-- Reconectar a mesma conta atualiza a linha em vez de criar uma irmã — sem
-- isto, autorizar de novo depois de um problema deixaria duas entradas com
-- o mesmo nome na tela de escolha, e uma delas com credencial morta.
create unique index if not exists drive_contas_agencia_email_idx
    on public.drive_contas (workspace_id, email);

create index if not exists drive_contas_agencia_idx
    on public.drive_contas (workspace_id);

alter table public.drive_contas enable row level security;

drop policy if exists "membro ve as contas do drive" on public.drive_contas;
create policy "membro ve as contas do drive"
    on public.drive_contas for select
    using (private.papel_na_agencia(workspace_id) is not null);

-- Sem política de escrita: quem grava é `api/social-callback.ts`, com a
-- chave de serviço, a partir do que o Google respondeu. Uma política aqui
-- deixaria o navegador afirmar uma conexão que não existe.
--
-- Apagar é exceção, pelo mesmo motivo de antes: desconectar é decisão de
-- quem administra e precisa funcionar mesmo que a rota esteja fora do ar.
drop policy if exists "gestor desconecta conta do drive" on public.drive_contas;
create policy "gestor desconecta conta do drive"
    on public.drive_contas for delete
    using (private.papel_na_agencia(workspace_id) in ('owner', 'admin', 'manager'));

-- ---------------------------------------------------------------------
-- A credencial de cada conta: RLS ligada e **zero políticas**
-- ---------------------------------------------------------------------
create table if not exists public.drive_contas_credenciais (
    conta_id uuid primary key
        references public.drive_contas(id) on delete cascade,
    refresh_token text not null,
    access_token text,
    expira_em timestamptz,
    atualizado_em timestamptz not null default now()
);

alter table public.drive_contas_credenciais enable row level security;

-- ---------------------------------------------------------------------
-- O que já estava conectado vira a primeira conta
--
-- Sem isto, quem conectou o Drive ontem abriria a tela hoje e veria "nenhuma
-- conta" — e as peças que apontam para arquivos daquela conta parariam de
-- ter miniatura, cópia e player. Migração que perde configuração é migração
-- que gera chamado.
-- ---------------------------------------------------------------------
insert into public.drive_contas (workspace_id, email, conectado_por, conectado_em)
select d.workspace_id, d.email, d.conectado_por, d.conectado_em
  from public.drive_da_agencia d
 where not exists (
     select 1 from public.drive_contas c
      where c.workspace_id = d.workspace_id
        and c.email is not distinct from d.email
 );

insert into public.drive_contas_credenciais (conta_id, refresh_token, access_token, expira_em)
select c.id, k.refresh_token, k.access_token, k.expira_em
  from public.drive_credenciais k
  join public.drive_da_agencia d on d.workspace_id = k.workspace_id
  join public.drive_contas c
    on c.workspace_id = d.workspace_id
   and c.email is not distinct from d.email
 where not exists (
     select 1 from public.drive_contas_credenciais x where x.conta_id = c.id
 );
