-- =====================================================================
-- Aparência e apresentação do Orquesia
--
-- A marca do produto, a paleta, os banners das telas de entrada e o que os
-- buscadores leem estavam escritos dentro dos componentes. Trocar a foto da
-- tela de login era mexer em JSX, abrir PR e esperar deploy — e a cor roxa
-- aparecia literal em dezenas de arquivos.
--
-- Uma linha só, de propósito: isto não é configuração por agência. A agência
-- tem o whitelabel dela em `workspaces` (logo, cores, favicon), e é esse que
-- pinta o portal do cliente dela. O que está aqui é a cara do **produto**,
-- que só o dono do SaaS muda.
--
-- Nada aqui é segredo: tudo é impresso na tela de entrada, que é pública. O
-- que decide quem escreve é `platform_admins`.
-- =====================================================================

create table if not exists public.saas_settings (
    -- Chave booleana com `check (unica)`: o Postgres passa a recusar a
    -- segunda linha. Sem isso, um insert distraído criaria uma configuração
    -- paralela e a tela leria qual das duas? A resposta seria "a que o
    -- `limit 1` pegar" — que o Postgres não promete.
    unica boolean primary key default true,
    constraint saas_settings_linha_unica check (unica),

    -- Marca
    nome text not null default 'Orquesia',
    logo_url text,
    logo_escuro_url text,
    favicon_url text,

    -- Paleta. O roxo é o que já estava em tela; ver o levantamento em
    -- src/components/ui/button.tsx.
    cor_primaria text not null default '#7c3aed',
    cor_secundaria text not null default '#4f46e5',
    cor_destaque text not null default '#10b981',

    -- Banners das duas portas de entrada
    banner_login_url text,
    banner_portal_url text,

    -- Textos das mesmas duas portas
    titulo_login text,
    subtitulo_login text,
    titulo_portal text,
    subtitulo_portal text,

    -- Apresentação para buscadores e para a prévia de link
    seo_titulo text,
    seo_descricao text,
    seo_imagem_url text,
    seo_palavras text,
    seo_indexar boolean not null default true,
    seo_url_canonica text,

    -- Contato e obrigações legais, exibidos no rodapé das telas públicas
    email_suporte text,
    url_termos text,
    url_privacidade text,

    updated_at timestamptz not null default now(),
    updated_by uuid references auth.users(id) on delete set null
);

-- ---------------------------------------------------------------------
-- Cor é cor, endereço é endereço
--
-- Estes valores vão para `style` e para `src` de <img> na tela pública. Sem
-- restrição, um valor gravado errado — ou de propósito — vira
-- `javascript:...` num atributo que o navegador executa. A validação mora no
-- banco porque é o último ponto por onde tudo passa: a tela também valida,
-- mas a tela é o que se contorna.
-- ---------------------------------------------------------------------
alter table public.saas_settings
    drop constraint if exists saas_settings_cores_hex;
alter table public.saas_settings
    add constraint saas_settings_cores_hex check (
        cor_primaria ~ '^#[0-9a-fA-F]{6}$' and
        cor_secundaria ~ '^#[0-9a-fA-F]{6}$' and
        cor_destaque ~ '^#[0-9a-fA-F]{6}$'
    );

alter table public.saas_settings
    drop constraint if exists saas_settings_urls_http;
alter table public.saas_settings
    add constraint saas_settings_urls_http check (
        -- `/imagem.jpg` é aceito: os arquivos que já vêm no repositório são
        -- servidos pela própria origem, e exigir domínio obrigaria a
        -- reescrevê-los como absolutos só para passar na restrição.
        (logo_url          is null or logo_url          ~ '^(https?://|/)') and
        (logo_escuro_url   is null or logo_escuro_url   ~ '^(https?://|/)') and
        (favicon_url       is null or favicon_url       ~ '^(https?://|/)') and
        (banner_login_url  is null or banner_login_url  ~ '^(https?://|/)') and
        (banner_portal_url is null or banner_portal_url ~ '^(https?://|/)') and
        (seo_imagem_url    is null or seo_imagem_url    ~ '^(https?://|/)') and
        (seo_url_canonica  is null or seo_url_canonica  ~ '^https?://') and
        (url_termos        is null or url_termos        ~ '^(https?://|/)') and
        (url_privacidade   is null or url_privacidade   ~ '^(https?://|/)')
    );

-- A linha nasce com o padrão. A tela precisa de algo para ler antes de
-- alguém ter salvo qualquer coisa, e um `update` numa tabela vazia não
-- falha — ele só não muda nada, em silêncio.
insert into public.saas_settings (unica) values (true)
on conflict (unica) do nothing;

alter table public.saas_settings enable row level security;

-- ---------------------------------------------------------------------
-- Só o dono do produto escreve. E só ele lê a tabela.
--
-- Ler a tabela inteira é privilégio de admin não por sigilo, mas por
-- disciplina: o dia em que alguém acrescentar uma coluna que não deveria ser
-- pública, o `select *` de uma sessão anônima já estaria liberado. Quem não
-- é admin lê pela função abaixo, que tem lista fechada — o mesmo desenho de
-- `marca_da_agencia`.
-- ---------------------------------------------------------------------
drop policy if exists "admin le a aparencia" on public.saas_settings;
create policy "admin le a aparencia"
    on public.saas_settings for select
    using (private.eh_admin_da_plataforma());

drop policy if exists "admin altera a aparencia" on public.saas_settings;
create policy "admin altera a aparencia"
    on public.saas_settings for update
    using (private.eh_admin_da_plataforma())
    with check (private.eh_admin_da_plataforma());

-- Sem política de INSERT nem de DELETE: a linha é uma e já existe. Criar ou
-- apagar aqui é operação de migração, não de sessão autenticada.

-- ---------------------------------------------------------------------
-- Leitura pública
--
-- A tela de entrada e a porta do portal do cliente são anônimas por
-- definição: quem chega ainda não provou ser ninguém. Sem esta função, a
-- primeira coisa que qualquer visitante vê seria a marca embutida no código.
--
-- Lista fechada de propósito. `updated_by` é o uuid de uma pessoa e não tem
-- nada que fazer numa resposta pública.
-- ---------------------------------------------------------------------
create or replace function public.aparencia_do_saas()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object(
        'nome', s.nome,
        'logo_url', s.logo_url,
        'logo_escuro_url', s.logo_escuro_url,
        'favicon_url', s.favicon_url,
        'cor_primaria', s.cor_primaria,
        'cor_secundaria', s.cor_secundaria,
        'cor_destaque', s.cor_destaque,
        'banner_login_url', s.banner_login_url,
        'banner_portal_url', s.banner_portal_url,
        'titulo_login', s.titulo_login,
        'subtitulo_login', s.subtitulo_login,
        'titulo_portal', s.titulo_portal,
        'subtitulo_portal', s.subtitulo_portal,
        'seo_titulo', s.seo_titulo,
        'seo_descricao', s.seo_descricao,
        'seo_imagem_url', s.seo_imagem_url,
        'seo_palavras', s.seo_palavras,
        'seo_indexar', s.seo_indexar,
        'seo_url_canonica', s.seo_url_canonica,
        'email_suporte', s.email_suporte,
        'url_termos', s.url_termos,
        'url_privacidade', s.url_privacidade
    )
    from public.saas_settings s
    limit 1;
$$;

revoke all on function public.aparencia_do_saas() from public;
grant execute on function public.aparencia_do_saas() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Carimbo de quem salvou
--
-- Em trigger e não na tela: a tela manda o que ela quer, e "quem alterou"
-- não é dela para afirmar. Aqui vem de `auth.uid()`, que é a sessão.
-- ---------------------------------------------------------------------
create or replace function public.saas_settings_carimbar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.updated_at := now();
    new.updated_by := (select auth.uid());
    return new;
end;
$$;

drop trigger if exists saas_settings_carimbo on public.saas_settings;
create trigger saas_settings_carimbo
    before update on public.saas_settings
    for each row execute function public.saas_settings_carimbar();
