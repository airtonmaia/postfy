/**
 * Publicação numa **Página do Facebook**.
 *
 * ### Por que um arquivo separado, e não um parâmetro em `instagram.ts`
 *
 * São dois fluxos de OAuth diferentes, e misturá-los quebra o que já funciona:
 *
 * | | login do Instagram | login do Facebook (aqui) |
 * |---|---|---|
 * | autorização | `www.instagram.com/oauth/authorize` | `www.facebook.com/.../dialog/oauth` |
 * | troca do código | `api.instagram.com` (POST form) | `graph.facebook.com` (query) |
 * | chamadas | `graph.instagram.com` | `graph.facebook.com` |
 * | token que publica | o da conta | o **da Página**, via `/me/accounts` |
 * | app id | `INSTAGRAM_APP_ID` | `FACEBOOK_APP_ID` — **outro app** |
 *
 * **E os escopos daqui invalidam a autorização do Instagram.**
 * `pages_show_list`, `pages_read_engagement` e `pages_manage_posts` fazem a
 * tela do Instagram recusar, com um erro que aparece só depois do login e não
 * nomeia qual escopo é o culpado. Por isso os dois fluxos nunca compartilham
 * uma requisição, e por isso `api/_lib/meta.ts` foi apagado em `e9e7792` em
 * vez de virar um parâmetro.
 *
 * ### O token que publica não é o que o login devolve
 *
 * O login devolve o token **do usuário**. Publicar numa Página exige o token
 * **da Página**, que vem de `/me/accounts`. Guardar o do usuário faz a
 * publicação falhar com "permissão insuficiente" depois de a conexão já
 * parecer pronta — que é o pior momento para descobrir.
 *
 * O token da Página não expira enquanto o token de usuário que o gerou for
 * válido, e por isso não há `renovarToken` aqui: o equivalente é reconectar.
 */

const VERSAO = 'v21.0';
const AUTORIZAR = `https://www.facebook.com/${VERSAO}/dialog/oauth`;
const GRAPH = `https://graph.facebook.com/${VERSAO}`;

/**
 * O mínimo para listar as Páginas e publicar nelas.
 *
 * **Nunca no mesmo pedido que os escopos do Instagram** — ver o cabeçalho.
 */
export const ESCOPOS_FACEBOOK = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
].join(',');

export interface PaginaDoFacebook {
  accountId: string;
  accountName: string;
  /** O token **da Página**. É este que publica, e não o do usuário. */
  tokenDaPagina: string;
}

export class ErroDoFacebook extends Error {
  status: number;
  constructor(mensagem: string, status = 502) {
    super(mensagem);
    this.name = 'ErroDoFacebook';
    this.status = status;
  }
}

const chamar = async (url: string, init?: RequestInit): Promise<any> => {
  const resposta = await fetch(url, init);
  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    // A mensagem da Meta vai para o log; ao cliente volta algo curto. O corpo
    // de erro dela às vezes ecoa o token na URL.
    const detalhe = dados?.error?.message || resposta.statusText;
    console.error('[facebook]', resposta.status, String(detalhe).slice(0, 300));
    throw new ErroDoFacebook(
      dados?.error?.error_user_msg || 'O Facebook recusou a operação.'
    );
  }
  return dados;
};

/** Para onde mandar o navegador. O `state` já vem assinado de fora. */
export const urlDeAutorizacao = (
  appId: string,
  redirectUri: string,
  estado: string
): string =>
  `${AUTORIZAR}?client_id=${encodeURIComponent(appId)}` +
  `&redirect_uri=${encodeURIComponent(redirectUri)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(ESCOPOS_FACEBOOK)}` +
  `&state=${encodeURIComponent(estado)}`;

/**
 * Código → token de usuário de longa duração.
 *
 * Dois saltos, como no Instagram e pela mesma razão: o primeiro token vale
 * cerca de uma hora, e sem a segunda troca a conexão morre no mesmo dia — o
 * cliente descobre quando a publicação agendada falha, de madrugada.
 *
 * Aqui os parâmetros vão **na query**, e não em corpo form-encoded: é a
 * diferença que faz a mesma chamada do Instagram devolver 400 sem dizer por
 * quê.
 */
export const trocarCodigoPorToken = async (
  codigo: string,
  redirectUri: string,
  appId: string,
  appSecret: string
): Promise<{ token: string; expiraEm: number | null }> => {
  const curto = await chamar(
    `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${encodeURIComponent(codigo)}`
  );

  const longo = await chamar(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(curto.access_token)}`
  );

  return {
    token: longo.access_token,
    expiraEm: typeof longo.expires_in === 'number' ? longo.expires_in : null,
  };
};

/**
 * As Páginas que a pessoa administra, com o token de cada uma.
 *
 * **É este token que publica.** O do usuário, que o login devolveu, serve
 * para listar as Páginas e mais nada: publicar com ele falha com "permissão
 * insuficiente" depois de a conexão já parecer pronta.
 */
export const paginasDoUsuario = async (
  tokenDoUsuario: string
): Promise<PaginaDoFacebook[]> => {
  const resposta = await chamar(
    `${GRAPH}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(tokenDoUsuario)}`
  );

  return (resposta.data || [])
    .filter((p: any) => p?.id && p?.access_token)
    .map((p: any) => ({
      accountId: String(p.id),
      accountName: p.name || String(p.id),
      tokenDaPagina: p.access_token,
    }));
};

/**
 * Publica na Página.
 *
 * **Um passo, e não dois.** Diferente do Instagram, não há contêiner a criar
 * nem processamento a esperar: `/photos` já recebe a URL e publica. A espera
 * de `esperarProcessamento` não tem equivalente aqui, e acrescentá-la só
 * adicionaria latência.
 *
 * A Meta **baixa** a mídia da URL informada, então ela precisa ser pública e
 * estável — uma URL assinada de curta duração falha aqui de forma
 * intermitente, que é o pior modo de falhar.
 *
 * Vídeo vai por `/videos`, que é outro endpoint: mandar `.mp4` para `/photos`
 * devolve um erro que fala de formato de imagem e não diz o que fazer.
 */
export const publicarNoFacebook = async (
  pageId: string,
  tokenDaPagina: string,
  mediaUrl: string,
  legenda: string
): Promise<string> => {
  const ehVideo = /\.(mp4|mov|webm)(\?|$)/i.test(mediaUrl);

  const corpo = ehVideo
    ? { file_url: mediaUrl, description: legenda, access_token: tokenDaPagina }
    : { url: mediaUrl, caption: legenda, access_token: tokenDaPagina };

  const publicado = await chamar(`${GRAPH}/${pageId}/${ehVideo ? 'videos' : 'photos'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });

  // `post_id` é o id do post no feed; `id` é o da foto. O primeiro é o que
  // serve para buscar métrica e montar o permalink.
  const id = publicado.post_id || publicado.id;
  if (!id) throw new ErroDoFacebook('O Facebook não devolveu o id da publicação.');

  return String(id);
};
