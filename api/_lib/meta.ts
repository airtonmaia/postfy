/**
 * Publicação no Instagram e no Facebook pela Graph API da Meta.
 *
 * O Instagram publica em dois passos, e não em um: primeiro cria-se um
 * "container" com a mídia, depois publica-se o container. A mídia precisa
 * estar numa URL pública que a Meta consiga baixar — por isso o upload no R2
 * com domínio público é pré-requisito, e não detalhe.
 *
 * Sobre a permissão: `instagram_content_publish` foi descontinuada em janeiro
 * de 2025 e substituída por `instagram_business_content_publish`, junto de
 * `instagram_business_basic`. Cada uma exige revisão de app à parte na Meta,
 * com screencast do fluxo completo, e leva de duas a quatro semanas.
 *
 * Enquanto a revisão não passa, dá para publicar na própria conta com o app
 * em modo de desenvolvimento, adicionando a conta como Instagram Tester.
 */

const GRAPH = 'https://graph.facebook.com/v21.0';

export const ESCOPOS_META = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'pages_show_list',
  'pages_read_engagement',
].join(',');

export interface ContaConectada {
  accountId: string;
  accountName: string;
  accessToken: string;
  expiresAt: string | null;
}

export class ErroDaMeta extends Error {
  status: number;
  constructor(mensagem: string, status = 502) {
    super(mensagem);
    this.name = 'ErroDaMeta';
    this.status = status;
  }
}

const chamar = async (url: string, init?: RequestInit): Promise<any> => {
  const resposta = await fetch(url, init);
  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    // A mensagem da Meta vai para o log; ao cliente volta algo curto. O
    // corpo de erro dela às vezes ecoa o token na URL.
    const detalhe = dados?.error?.message || resposta.statusText;
    console.error('[meta]', resposta.status, String(detalhe).slice(0, 300));
    throw new ErroDaMeta(dados?.error?.error_user_msg || 'A rede social recusou a operação.');
  }
  return dados;
};

/** Troca o código do OAuth por um token de longa duração. */
export const trocarCodigoPorToken = async (
  codigo: string,
  redirectUri: string,
  appId: string,
  appSecret: string
): Promise<{ token: string; expiraEm: number | null }> => {
  const curto = await chamar(
    `${GRAPH}/oauth/access_token?client_id=${appId}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${encodeURIComponent(codigo)}`
  );

  // O token curto vale uma hora. Sem esta troca, a conexão morre no mesmo dia
  // e o cliente descobre quando a publicação falha.
  const longo = await chamar(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${appId}&client_secret=${encodeURIComponent(appSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(curto.access_token)}`
  );

  return {
    token: longo.access_token,
    expiraEm: typeof longo.expires_in === 'number' ? longo.expires_in : null,
  };
};

/** Contas do Instagram business ligadas às páginas do usuário. */
export const contasDoUsuario = async (token: string): Promise<ContaConectada[]> => {
  const paginas = await chamar(
    `${GRAPH}/me/accounts?fields=name,access_token,instagram_business_account{id,username}` +
      `&access_token=${encodeURIComponent(token)}`
  );

  const contas: ContaConectada[] = [];
  for (const pagina of paginas.data || []) {
    const ig = pagina.instagram_business_account;
    if (!ig?.id) continue;
    contas.push({
      accountId: ig.id,
      accountName: ig.username || pagina.name,
      // O token da página é o que publica, não o do usuário.
      accessToken: pagina.access_token,
      expiresAt: null,
    });
  }
  return contas;
};

/**
 * Publica no Instagram: cria o container e depois o publica.
 *
 * A Meta baixa a mídia da URL informada, então ela precisa ser pública e
 * estável. Uma URL assinada de curta duração falha aqui de forma
 * intermitente, que é o pior modo de falhar.
 */
export const publicarNoInstagram = async (
  accountId: string,
  token: string,
  mediaUrl: string,
  legenda: string
): Promise<string> => {
  const ehVideo = /\.(mp4|mov|webm)(\?|$)/i.test(mediaUrl);

  const container = await chamar(`${GRAPH}/${accountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      [ehVideo ? 'video_url' : 'image_url']: mediaUrl,
      ...(ehVideo ? { media_type: 'REELS' } : {}),
      caption: legenda,
      access_token: token,
    }),
  });

  if (!container.id) {
    throw new ErroDaMeta('A rede não devolveu o identificador da mídia.');
  }

  // Vídeo precisa terminar de processar antes de publicar. Publicar antes
  // devolve erro genérico e some com o post.
  if (ehVideo) {
    await esperarProcessamento(container.id, token);
  }

  const publicado = await chamar(`${GRAPH}/${accountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  });

  return publicado.id;
};

const esperarProcessamento = async (
  containerId: string,
  token: string,
  tentativas = 12
): Promise<void> => {
  for (let i = 0; i < tentativas; i++) {
    const estado = await chamar(
      `${GRAPH}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`
    );
    if (estado.status_code === 'FINISHED') return;
    if (estado.status_code === 'ERROR') {
      throw new ErroDaMeta('A rede não conseguiu processar o vídeo.');
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new ErroDaMeta('O vídeo demorou demais para ser processado.');
};
