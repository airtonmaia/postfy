-- =====================================================================
-- O app instalável passa a ser do dono do produto, não do repositório.
--
-- A entrega do Web Push deixou o PWA inteiro estático: `manifest.webmanifest`
-- com o nome "Orquesia" escrito à mão, e os ícones gerados dentro de
-- `public/`. Trocar qualquer um deles exigia commit e deploy — o dono do
-- produto não tinha como mexer, e o `Admin → Design` prometia, em texto, que
-- ali se define "a cara do Orquesia".
--
-- Três colunas, e só três, porque o resto **já existe e é derivado**:
--
--   nome do app          ← `nome`
--   descrição            ← `seo_descricao`
--   cor do tema          ← `cor_primaria`
--
-- O que não dá para derivar:
--
-- * **O ícone.** `logo_url` costuma ser horizontal e com texto; ícone de app
--   é quadrado e some numa miniatura de 48px. Usar o logo daria um ícone
--   esmagado na tela de início — e o lugar onde ele aparece é exatamente
--   aquele em que a marca precisa ser reconhecida de relance.
-- * **O nome curto.** É o que fica embaixo do ícone, e o sistema operacional
--   corta em ~12 caracteres. "Minha Agência Digital" vira "Minha Agên…".
-- * **A cor de fundo.** É a tela que o Android pinta enquanto o app abre.
--   Ela acompanha o fundo da interface, não a cor da marca: usar a primária
--   faria a abertura piscar roxo e cair num app branco.
-- =====================================================================

alter table public.saas_settings
    add column if not exists pwa_nome_curto text;

alter table public.saas_settings
    add column if not exists pwa_icone_url text;

alter table public.saas_settings
    add column if not exists pwa_cor_fundo text;

-- ---------------------------------------------------------------------
-- A lista fechada ganha os três — e ela é repetida por inteiro
--
-- `aparencia_do_saas` é `security definer` e existe para a tela de entrada,
-- que é anônima, poder ler a marca sem alcançar a tabela. A lista é fechada
-- de propósito: coluna nova **não** nasce visível, ao contrário de
-- `portal_dados`, que responde com a linha inteira e já vazou três colunas
-- por isso.
--
-- O preço dessa escolha é este: quem acrescenta coluna e esquece daqui vê o
-- campo salvar no banco e **nunca aparecer na tela**, sem erro em lugar
-- nenhum. `create or replace` substitui, não emenda, então a lista vai
-- inteira.
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
        'url_privacidade', s.url_privacidade,
        'pwa_nome_curto', s.pwa_nome_curto,
        'pwa_icone_url', s.pwa_icone_url,
        'pwa_cor_fundo', s.pwa_cor_fundo
    )
    from public.saas_settings s
    limit 1;
$$;

grant execute on function public.aparencia_do_saas() to anon, authenticated;
