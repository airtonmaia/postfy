-- ---------------------------------------------------------------------
-- Preferências por usuário
--
-- Tema e última agência aberta viviam no localStorage. Isso significava
-- preferência presa a um navegador: quem entrava pelo celular pegava o tema
-- claro e caía na primeira agência da lista, sempre.
--
-- Aqui a linha é do próprio usuário, não da agência: um membro de duas
-- agências tem um tema só, e a última agência aberta é dele.
-- ---------------------------------------------------------------------
create table if not exists public.user_settings (
    user_id uuid primary key references auth.users(id) on delete cascade,
    theme text not null default 'light' check (theme in ('light', 'dark')),
    last_workspace_id uuid references public.workspaces(id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

-- Cada um enxerga e escreve só a própria linha. Não há política para outros
-- papéis de propósito: preferência de um membro não é assunto do dono da
-- agência.
drop policy if exists "usuario le a propria preferencia" on public.user_settings;
create policy "usuario le a propria preferencia"
    on public.user_settings for select
    using (user_id = (select auth.uid()));

drop policy if exists "usuario cria a propria preferencia" on public.user_settings;
create policy "usuario cria a propria preferencia"
    on public.user_settings for insert
    with check (user_id = (select auth.uid()));

drop policy if exists "usuario altera a propria preferencia" on public.user_settings;
create policy "usuario altera a propria preferencia"
    on public.user_settings for update
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

-- last_workspace_id aponta para uma agência que o usuário pode ter deixado.
-- O `on delete set null` já cobre a exclusão; a leitura no cliente ainda
-- confere se ele continua membro antes de abrir.
create index if not exists user_settings_last_workspace_idx
    on public.user_settings (last_workspace_id);
