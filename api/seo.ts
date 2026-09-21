import { rota } from './_lib/rota.js';
import { clienteAnonimo } from './_lib/auth.js';

/**
 * O que os robôs leem.
 *
 * O app é uma SPA servida estática: o HTML que sai do `vite build` é sempre o
 * mesmo, e as meta tags só existem depois que o JavaScript roda. O Google
 * executa JavaScript e enxerga o que a tela monta; **os robôs de prévia de
 * link não**. WhatsApp, Facebook, LinkedIn, Slack e Telegram baixam o HTML
 * cru, leem `og:*` e vão embora. Para eles, injetar meta tag em tempo de
 * execução é o mesmo que não ter nenhuma — o link do produto aparecia como um
 * retângulo cinza sem título.
 *
 * Por isso esta rota: `vercel.json` manda para cá as requisições cujo
 * user-agent é de um desses robôs, e ela devolve um HTML pequeno com as tags
 * preenchidas do banco. Quem tem navegador continua recebendo o `index.html`
 * de sempre — o desvio é pelo user-agent, e não pelo caminho.
 *
 * Serve também `/robots.txt`, pelo mesmo motivo de ele precisar mudar sem
 * deploy: a chave "permitir indexação" fica na tela de SEO.
 *
 * Uma pessoa que caia aqui (user-agent estranho, extensão, curl) não fica
 * presa: a página tem link e `refresh` para o app.
 */

const APARENCIA_PADRAO = {
  nome: 'Orquesia',
  seo_titulo: null as string | null,
  seo_descricao: null as string | null,
  seo_imagem_url: null as string | null,
  seo_palavras: null as string | null,
  seo_indexar: true,
  seo_url_canonica: null as string | null,
  cor_primaria: null as string | null,
  pwa_nome_curto: null as string | null,
  pwa_icone_url: null as string | null,
  pwa_cor_fundo: null as string | null,
};

/**
 * O manifest do app instalável, montado do que o dono do produto configurou.
 *
 * **Ele é servido por esta rota e não existe mais como arquivo em
 * `public/`.** Os dois não podem conviver: na Vercel o sistema de arquivos é
 * consultado **antes** dos `rewrites`, então um `manifest.webmanifest`
 * estático venceria o desvio e o que o dono configurasse nunca apareceria —
 * sem erro, com a tela de Design dizendo que salvou. (Medido: com o arquivo
 * presente, `/portal-hero.jpg` volta `image/jpeg`; ausente, o coringa
 * devolve o `index.html`.)
 *
 * Três campos são derivados do que já existe — nome, descrição e cor do tema
 * saem da marca do produto. Só o que não dá para derivar virou coluna: o
 * ícone (o logo costuma ser horizontal e viraria uma miniatura esmagada), o
 * nome curto (o sistema corta em ~12 caracteres embaixo do ícone) e a cor de
 * fundo (é a tela que o Android pinta enquanto o app abre, e ela acompanha o
 * fundo da interface, não a marca).
 */
const manifesto = (a: typeof APARENCIA_PADRAO, base: string) => {
  const nome = a.nome || APARENCIA_PADRAO.nome;
  /**
   * Sem ícone configurado, valem os arquivos do repositório — que são a
   * marca do Orquesia. O manifest **nunca** fica sem ícone: sem 192 e 512 o
   * navegador simplesmente não oferece a instalação, e o dono concluiria que
   * o campo quebrou o app.
   */
  const icone = (a.pwa_icone_url || '').trim();
  const icones = icone
    ? [
        // Um arquivo só, declarado nos dois tamanhos que o navegador exige.
        // Quem envia a arte manda um PNG quadrado grande; reamostrar no
        // servidor exigiria uma biblioteca de imagem numa função que tem 45
        // segundos de orçamento e divide o slot com a publicação.
        { src: icone, sizes: '192x192', type: 'image/png' },
        { src: icone, sizes: '512x512', type: 'image/png' },
        { src: icone, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ]
    : [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ];

  return {
    name: nome,
    short_name: (a.pwa_nome_curto || nome).slice(0, 12),
    description: a.seo_descricao || `${nome} — gestão de agências de conteúdo`,
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: a.pwa_cor_fundo || '#f8fafc',
    theme_color: a.cor_primaria || '#7c3aed',
    lang: 'pt-BR',
    id: `${base}/`,
    icons: icones,
  };
};

/**
 * Escapa para dentro de atributo HTML.
 *
 * O conteúdo vem do banco, escrito por um admin — mas "escrito por gente de
 * confiança" não é o mesmo que "seguro para concatenar em HTML": uma aspa
 * numa descrição já fecharia o atributo, e o resto da frase viraria marcação.
 */
const escapar = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const baseDoApp = () =>
  (process.env.APP_URL || 'https://app.orquesia.com.br').replace(/\/+$/, '');

const lerAparencia = async () => {
  try {
    const { data, error } = await clienteAnonimo().rpc('aparencia_do_saas');
    if (error || !data) return APARENCIA_PADRAO;
    return { ...APARENCIA_PADRAO, ...(data as Record<string, unknown>) } as typeof APARENCIA_PADRAO;
  } catch {
    // A prévia de um link não é lugar para 500: o robô mostraria o retângulo
    // cinza que esta rota existe para evitar. Cai no padrão.
    return APARENCIA_PADRAO;
  }
};

const robots = (indexar: boolean, base: string): string =>
  indexar
    ? [
        'User-agent: *',
        // O produto inteiro é atrás de login; o que faz sentido indexar é a
        // porta de entrada. Listar as telas internas só geraria resultado que
        // devolve a tela de login para quem clicar.
        'Disallow: /admin',
        'Disallow: /api/',
        'Disallow: /portal-do-cliente',
        'Allow: /',
        '',
        `Sitemap: ${base}/sitemap.xml`,
        '',
      ].join('\n')
    : ['User-agent: *', 'Disallow: /', ''].join('\n');

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const a = await lerAparencia();
  const base = baseDoApp();

  if (url.pathname === '/manifest.webmanifest') {
    return new Response(JSON.stringify(manifesto(a, base), null, 2), {
      status: 200,
      headers: {
        // O tipo importa: com `application/json` alguns navegadores aceitam,
        // e com `text/html` — que é o que o coringa devolveria — nenhum
        // aceita, e a instalação some sem explicação.
        'content-type': 'application/manifest+json; charset=utf-8',
        // Cinco minutos, como o resto desta rota: o manifest é lido na
        // instalação e raramente muda, mas trocar o ícone não pode levar um
        // dia para valer.
        'cache-control': 'public, max-age=300',
      },
    });
  }

  if (url.pathname === '/robots.txt') {
    return new Response(robots(a.seo_indexar !== false, base), {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    });
  }

  const nome = a.nome || APARENCIA_PADRAO.nome;
  const titulo = a.seo_titulo || `${nome} — gestão de agências de conteúdo`;
  const descricao =
    a.seo_descricao ||
    `${nome} organiza pautas, aprovações e produção de conteúdo da sua agência num lugar só.`;
  const canonica = a.seo_url_canonica || `${base}${url.pathname}`;
  const imagem = a.seo_imagem_url
    ? a.seo_imagem_url.startsWith('/')
      ? `${base}${a.seo_imagem_url}`
      : a.seo_imagem_url
    : null;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapar(titulo)}</title>
<meta name="description" content="${escapar(descricao)}">
${a.seo_palavras ? `<meta name="keywords" content="${escapar(a.seo_palavras)}">` : ''}
<meta name="robots" content="${a.seo_indexar !== false ? 'index, follow' : 'noindex, nofollow'}">
<link rel="canonical" href="${escapar(canonica)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapar(nome)}">
<meta property="og:title" content="${escapar(titulo)}">
<meta property="og:description" content="${escapar(descricao)}">
<meta property="og:url" content="${escapar(canonica)}">
${imagem ? `<meta property="og:image" content="${escapar(imagem)}">` : ''}
<meta name="twitter:card" content="${imagem ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${escapar(titulo)}">
<meta name="twitter:description" content="${escapar(descricao)}">
${imagem ? `<meta name="twitter:image" content="${escapar(imagem)}">` : ''}
<meta http-equiv="refresh" content="0; url=${escapar(canonica)}">
</head>
<body>
<h1>${escapar(titulo)}</h1>
<p>${escapar(descricao)}</p>
<p><a href="${escapar(canonica)}">Abrir o ${escapar(nome)}</a></p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Cinco minutos: tempo de um robô repetir a busca sem que uma correção
      // de título fique presa por horas.
      'cache-control': 'public, max-age=300',
    },
  });
}

/** Handler no formato Web, exportado para os testes chamarem direto. */
export const GET = handler;

/**
 * Default no formato (req, res), que toda versão do builder da Vercel
 * entende. Ver o porquê em api/_lib/rota.ts.
 */
export default rota(handler);
