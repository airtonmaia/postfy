import { supabase } from './supabase';

/**
 * A cara do produto: marca, paleta, banners e o que os buscadores leem.
 *
 * Não confundir com o whitelabel da agência, que vive em `workspaces` e
 * pinta o portal do cliente dela. O que está aqui é o Orquesia — a tela de
 * entrada, a porta do portal antes de saber de qual agência é, o título da
 * aba. Uma linha só no banco (`saas_settings`), e só o admin da plataforma
 * escreve.
 *
 * A leitura pública passa por `aparencia_do_saas()`, uma função com lista
 * fechada de campos: a tela de entrada é anônima por definição, e a tabela
 * inteira não fica alcançável por sessão nenhuma que não seja de admin.
 */

export interface AparenciaDoSaas {
  nome: string;
  logoUrl: string | null;
  logoEscuroUrl: string | null;
  faviconUrl: string | null;

  corPrimaria: string;
  corSecundaria: string;
  corDestaque: string;

  bannerLoginUrl: string | null;
  bannerPortalUrl: string | null;

  tituloLogin: string | null;
  subtituloLogin: string | null;
  tituloPortal: string | null;
  subtituloPortal: string | null;

  seoTitulo: string | null;
  seoDescricao: string | null;
  seoImagemUrl: string | null;
  seoPalavras: string | null;
  seoIndexar: boolean;
  seoUrlCanonica: string | null;

  emailSuporte: string | null;
  urlTermos: string | null;
  urlPrivacidade: string | null;
}

/**
 * O que a tela mostra antes de o banco responder — e se ele nunca responder.
 *
 * Existe para a tela de entrada não piscar sem marca nem cor, e para o app
 * subir com o banco fora do ar. É o mesmo roxo que já estava em tela.
 */
export const APARENCIA_PADRAO: AparenciaDoSaas = {
  nome: 'Orquesia',
  logoUrl: null,
  logoEscuroUrl: null,
  faviconUrl: null,
  corPrimaria: '#7c3aed',
  corSecundaria: '#4f46e5',
  corDestaque: '#10b981',
  bannerLoginUrl: null,
  bannerPortalUrl: null,
  tituloLogin: null,
  subtituloLogin: null,
  tituloPortal: null,
  subtituloPortal: null,
  seoTitulo: null,
  seoDescricao: null,
  seoImagemUrl: null,
  seoPalavras: null,
  seoIndexar: true,
  seoUrlCanonica: null,
  emailSuporte: null,
  urlTermos: null,
  urlPrivacidade: null,
};

const daLinha = (l: any): AparenciaDoSaas => ({
  nome: l.nome || APARENCIA_PADRAO.nome,
  logoUrl: l.logo_url || null,
  logoEscuroUrl: l.logo_escuro_url || null,
  faviconUrl: l.favicon_url || null,
  corPrimaria: l.cor_primaria || APARENCIA_PADRAO.corPrimaria,
  corSecundaria: l.cor_secundaria || APARENCIA_PADRAO.corSecundaria,
  corDestaque: l.cor_destaque || APARENCIA_PADRAO.corDestaque,
  bannerLoginUrl: l.banner_login_url || null,
  bannerPortalUrl: l.banner_portal_url || null,
  tituloLogin: l.titulo_login || null,
  subtituloLogin: l.subtitulo_login || null,
  tituloPortal: l.titulo_portal || null,
  subtituloPortal: l.subtitulo_portal || null,
  seoTitulo: l.seo_titulo || null,
  seoDescricao: l.seo_descricao || null,
  seoImagemUrl: l.seo_imagem_url || null,
  seoPalavras: l.seo_palavras || null,
  seoIndexar: l.seo_indexar !== false,
  seoUrlCanonica: l.seo_url_canonica || null,
  emailSuporte: l.email_suporte || null,
  urlTermos: l.url_termos || null,
  urlPrivacidade: l.url_privacidade || null,
});

/** Texto vazio vira null: a coluna distingue "não preenchido" de "vazio". */
const ouNulo = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

const paraLinha = (a: Partial<AparenciaDoSaas>): Record<string, unknown> => {
  const linha: Record<string, unknown> = {};
  const texto: [keyof AparenciaDoSaas, string][] = [
    ['nome', 'nome'],
    ['logoUrl', 'logo_url'],
    ['logoEscuroUrl', 'logo_escuro_url'],
    ['faviconUrl', 'favicon_url'],
    ['corPrimaria', 'cor_primaria'],
    ['corSecundaria', 'cor_secundaria'],
    ['corDestaque', 'cor_destaque'],
    ['bannerLoginUrl', 'banner_login_url'],
    ['bannerPortalUrl', 'banner_portal_url'],
    ['tituloLogin', 'titulo_login'],
    ['subtituloLogin', 'subtitulo_login'],
    ['tituloPortal', 'titulo_portal'],
    ['subtituloPortal', 'subtitulo_portal'],
    ['seoTitulo', 'seo_titulo'],
    ['seoDescricao', 'seo_descricao'],
    ['seoImagemUrl', 'seo_imagem_url'],
    ['seoPalavras', 'seo_palavras'],
    ['seoUrlCanonica', 'seo_url_canonica'],
    ['emailSuporte', 'email_suporte'],
    ['urlTermos', 'url_termos'],
    ['urlPrivacidade', 'url_privacidade'],
  ];

  for (const [campo, coluna] of texto) {
    if (campo in a) linha[coluna] = ouNulo(a[campo] as string | null);
  }
  // `nome` é NOT NULL: apagá-lo na tela não pode apagar a marca no banco.
  if ('nome' in a) linha.nome = ouNulo(a.nome) ?? APARENCIA_PADRAO.nome;
  // Cores são NOT NULL pelo mesmo motivo, e o banco ainda confere o formato.
  for (const [campo, coluna] of [
    ['corPrimaria', 'cor_primaria'],
    ['corSecundaria', 'cor_secundaria'],
    ['corDestaque', 'cor_destaque'],
  ] as const) {
    if (campo in a) linha[coluna] = ouNulo(a[campo]) ?? APARENCIA_PADRAO[campo];
  }
  if ('seoIndexar' in a) linha.seo_indexar = Boolean(a.seoIndexar);

  return linha;
};

/**
 * Leitura pública, para as telas que rodam sem sessão.
 *
 * Devolve o padrão quando a rede falha ou a função não existe ainda: ninguém
 * deixa de entrar no sistema porque a cor não carregou. Por isso não estoura.
 */
export const carregarAparencia = async (): Promise<AparenciaDoSaas> => {
  try {
    const { data, error } = await supabase.rpc('aparencia_do_saas');
    if (error || !data) return APARENCIA_PADRAO;
    return daLinha(data);
  } catch {
    return APARENCIA_PADRAO;
  }
};

/**
 * Leitura da tabela, para a tela de administração.
 *
 * Aqui o erro sobe: se o admin abrir a tela de Design e o banco recusar, ele
 * precisa ver o motivo — não uma tela com os valores padrão que ele salvaria
 * por cima dos de verdade.
 */
export const carregarAparenciaComoAdmin = async (): Promise<AparenciaDoSaas> => {
  const { data, error } = await supabase
    .from('saas_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('A linha de configuração do produto não existe no banco.');
  return daLinha(data);
};

export const salvarAparencia = async (mudancas: Partial<AparenciaDoSaas>): Promise<void> => {
  const linha = paraLinha(mudancas);
  if (Object.keys(linha).length === 0) return;

  // `unica` é a chave da linha singleton. Sem o filtro, o PostgREST recusa o
  // update sem WHERE — e é bom que recuse.
  const { error } = await supabase
    .from('saas_settings')
    .update(linha)
    .eq('unica', true);

  if (error) throw new Error(error.message);
};
