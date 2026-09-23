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
  /**
   * A foto da Página, para a tela de escolha.
   *
   * Quem administra duas Páginas do mesmo cliente as distingue pela foto
   * antes de ler o nome — e nomes parecidos ("Loja", "Loja Oficial") são o
   * caso em que escolher errado é mais fácil. Opcional porque a Meta pode
   * não devolver, e uma escolha sem foto continua sendo uma escolha.
   */
  fotoUrl?: string;
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
    `${GRAPH}/me/accounts?fields=id,name,access_token,picture{url}` +
      `&access_token=${encodeURIComponent(tokenDoUsuario)}`
  );

  return (resposta.data || [])
    .filter((p: any) => p?.id && p?.access_token)
    .map((p: any) => ({
      accountId: String(p.id),
      accountName: p.name || String(p.id),
      tokenDaPagina: p.access_token,
      fotoUrl: p.picture?.data?.url,
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

/**
 * Story de **Página**, que não é o story do Instagram nem o feed daqui.
 *
 * Esta função não existia, e a ausência dela era a razão de "Feed + Story" não
 * ser oferecido para o Facebook: a primeira versão daquela entrega ofereceu o
 * formato assim mesmo, `publicarItem` retornava logo depois do feed, e a arte
 * do story era **descartada em silêncio** com a fila dizendo "publicado". A
 * pessoa subia duas artes, aprovava as duas com o cliente, e uma não saía.
 *
 * ### São três diferenças, e cada uma já custou tentativa
 *
 * **1. Nada de `/photos` com `published=true`.** O feed publica numa chamada;
 * o story exige **duas**: primeiro sobe a foto **não publicada**
 * (`published=false`), que devolve um `id`, e só então `/photo_stories`
 * transforma aquele `id` em story. Mandar a URL direto para `/photo_stories`
 * é recusado — ele só aceita `photo_id`.
 *
 * **2. Vídeo é outro endpoint e outro protocolo.** `/video_stories` é um
 * upload em fases: `start` devolve `video_id` e uma `upload_url` própria, o
 * arquivo vai **para essa URL** (não para o Graph, e com o token no cabeçalho
 * `Authorization: OAuth`), e um `finish` fecha. Mandar vídeo por
 * `/photo_stories` devolve erro de formato de imagem, que não diz o que fazer.
 *
 * **3. Story não leva legenda.** Como no Instagram: a Meta ignora o texto, e
 * mandá-lo faria a tela prometer uma legenda que nunca aparece.
 *
 * ### O que acontece quando a Meta recusa
 *
 * A permissão é a mesma do feed (`pages_manage_posts`), então a conexão que já
 * publica no feed publica story — mas se a Meta pedir mais alguma coisa, o erro
 * **aparece**: `publicarItem` publica o feed primeiro e captura a falha do
 * story em `last_error`, à vista na fila e na tela do conteúdo. É a diferença
 * que importa em relação ao bug antigo: antes a arte sumia sem nada dizer;
 * agora ou ela sai, ou a tela nomeia o motivo de não ter saído.
 */
export const publicarStoryNoFacebook = async (
  pageId: string,
  tokenDaPagina: string,
  mediaUrl: string
): Promise<string> => {
  const ehVideo = /\.(mp4|mov|webm)(\?|$)/i.test(mediaUrl);

  if (!ehVideo) {
    // Passo 1: a foto entra **não publicada**. Sem `published: false` ela vai
    // para o feed, e o cliente fica com a arte vertical no feed além do story.
    const foto = await chamar(`${GRAPH}/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: mediaUrl, published: false, access_token: tokenDaPagina }),
    });

    const fotoId = foto.id;
    if (!fotoId) throw new ErroDoFacebook('O Facebook não devolveu o id da foto do story.');

    // Passo 2: a foto vira story.
    const story = await chamar(`${GRAPH}/${pageId}/photo_stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_id: fotoId, access_token: tokenDaPagina }),
    });

    const id = story.post_id || story.id;
    if (!id) throw new ErroDoFacebook('O Facebook não confirmou a publicação do story.');
    return String(id);
  }

  // Vídeo: `start` reserva o id e devolve a URL de envio.
  const inicio = await chamar(`${GRAPH}/${pageId}/video_stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upload_phase: 'start', access_token: tokenDaPagina }),
  });

  const videoId = inicio.video_id;
  const urlDeEnvio = inicio.upload_url;
  if (!videoId || !urlDeEnvio) {
    throw new ErroDoFacebook('O Facebook não abriu o envio do story em vídeo.');
  }

  /**
   * O envio **não passa pelo Graph**, e o token vai no cabeçalho.
   *
   * `file_url` manda a Meta baixar o arquivo do R2 em vez de nós subirmos os
   * bytes — o que mantém a função serverless dentro do orçamento de tempo, que
   * é a mesma razão de o feed usar `url` em vez de multipart.
   */
  const envio = await fetch(String(urlDeEnvio), {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${tokenDaPagina}`,
      file_url: mediaUrl,
    },
  });

  if (!envio.ok) {
    const detalhe = await envio.text().catch(() => '');
    console.error('[facebook] envio do story em vídeo', envio.status, detalhe.slice(0, 300));
    throw new ErroDoFacebook('O Facebook recusou o envio do story em vídeo.');
  }

  const fim = await chamar(`${GRAPH}/${pageId}/video_stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      upload_phase: 'finish',
      video_id: videoId,
      access_token: tokenDaPagina,
    }),
  });

  const id = fim.post_id || videoId;
  if (!id) throw new ErroDoFacebook('O Facebook não confirmou a publicação do story.');
  return String(id);
};
