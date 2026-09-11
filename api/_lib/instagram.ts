/**
 * Instagram API com **login do Instagram**.
 *
 * Existiam dois caminhos para publicar no Instagram, e o projeto tinha
 * implementado o errado para o app que existe:
 *
 *   - *Instagram API com login do Facebook*: a pessoa entra com a conta do
 *     Facebook, a conta do Instagram precisa estar ligada a uma Página, e o
 *     token que publica é o **da Página**, obtido em `/me/accounts`. Tudo em
 *     `graph.facebook.com`. Era isto que estava aqui.
 *   - *Instagram API com login do Instagram*: a pessoa entra com a própria
 *     conta do Instagram, sem Página nenhuma no caminho. O token é da conta,
 *     e as chamadas vão para `api.instagram.com` e `graph.instagram.com`.
 *
 * O app "Orquesia" na Meta está configurado no segundo. Isso não é
 * preferência: no primeiro fluxo `/me` devolve o usuário do **Facebook**, e
 * um `POST /{id-do-facebook}/media` é recusado. O teste manual que passou —
 * `/me` devolvendo `28732739896414585` e esse mesmo id publicando em
 * `/media` e `/media_publish` — só acontece no fluxo do Instagram.
 *
 * Manter o código do outro fluxo seria pior que não ter nada: ele monta uma
 * URL de autorização que abre e falha só no fim, depois de a pessoa já ter
 * digitado a senha.
 *
 * O app id e o secret daqui **não são** os do app da Meta. São os que ficam
 * em Instagram → Configuração da API, e por isso as variáveis têm nome
 * próprio.
 */

const AUTORIZAR = 'https://www.instagram.com/oauth/authorize';
const TROCA = 'https://api.instagram.com/oauth/access_token';
const GRAPH = 'https://graph.instagram.com/v21.0';
/** `access_token` e `refresh_access_token` não levam versão no caminho. */
const GRAPH_RAIZ = 'https://graph.instagram.com';

/**
 * O mínimo para ler a conta e publicar.
 *
 * `pages_show_list` e `pages_read_engagement` saíram: são escopos do fluxo do
 * Facebook e **fazem a tela de autorização do Instagram recusar** — o erro
 * aparece só depois do login, e diz "escopo inválido" sem nomear qual.
 */
export const ESCOPOS_INSTAGRAM = [
  'instagram_business_basic',
  'instagram_business_content_publish',
].join(',');

export interface ContaDoInstagram {
  accountId: string;
  accountName: string;
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
    // A mensagem da Meta vai para o log; ao cliente volta algo curto. O corpo
    // de erro dela às vezes ecoa o token na URL.
    const detalhe =
      dados?.error?.message || dados?.error_message || resposta.statusText;
    console.error('[instagram]', resposta.status, String(detalhe).slice(0, 300));
    throw new ErroDaMeta(
      dados?.error?.error_user_msg || 'O Instagram recusou a operação.'
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
  `&scope=${encodeURIComponent(ESCOPOS_INSTAGRAM)}` +
  `&state=${encodeURIComponent(estado)}`;

/**
 * Código → token de longa duração, em dois saltos.
 *
 * O primeiro token vale **uma hora**. Sem a segunda troca, a conexão morre no
 * mesmo dia e o cliente descobre quando a publicação agendada falha, à noite,
 * sem ninguém olhando.
 *
 * O de longa duração vale 60 dias e **é renovável** — ver `renovarToken`.
 */
export const trocarCodigoPorToken = async (
  codigo: string,
  redirectUri: string,
  appId: string,
  appSecret: string
): Promise<{ token: string; expiraEm: number | null; accountId: string | null }> => {
  // Form-encoded, e por POST: este endpoint não aceita os parâmetros na query.
  const corpo = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code: codigo,
  });

  const curto = await chamar(TROCA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: corpo.toString(),
  });

  const longo = await chamar(
    `${GRAPH_RAIZ}/access_token?grant_type=ig_exchange_token` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&access_token=${encodeURIComponent(curto.access_token)}`
  );

  return {
    token: longo.access_token,
    expiraEm: typeof longo.expires_in === 'number' ? longo.expires_in : null,
    // A troca já devolve de quem é o token; poupa uma chamada.
    accountId: curto.user_id ? String(curto.user_id) : null,
  };
};

/**
 * Renova o token de 60 dias.
 *
 * Sem isto a conexão simplesmente para de funcionar dois meses depois de
 * conectada — e o sintoma é a publicação agendada falhando, não um aviso.
 * A Meta só renova token com mais de 24 horas de vida.
 */
export const renovarToken = async (
  token: string
): Promise<{ token: string; expiraEm: number | null }> => {
  const novo = await chamar(
    `${GRAPH_RAIZ}/refresh_access_token?grant_type=ig_refresh_token` +
      `&access_token=${encodeURIComponent(token)}`
  );
  return {
    token: novo.access_token,
    expiraEm: typeof novo.expires_in === 'number' ? novo.expires_in : null,
  };
};

/** De quem é o token. */
export const contaDoToken = async (token: string): Promise<ContaDoInstagram> => {
  const eu = await chamar(
    `${GRAPH}/me?fields=user_id,username,name&access_token=${encodeURIComponent(token)}`
  );

  // `user_id` é o id que publica. `id` vem junto e costuma ser o mesmo; fica
  // de reserva para não quebrar se a Meta parar de mandar um dos dois.
  const accountId = String(eu.user_id || eu.id || '');
  if (!accountId) {
    throw new ErroDaMeta('O Instagram não disse de quem é a conta autorizada.');
  }

  return {
    accountId,
    accountName: eu.username || eu.name || accountId,
  };
};

/**
 * Publica: cria o container e depois o publica.
 *
 * A Meta **baixa** a mídia da URL informada, então ela precisa ser pública e
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
    throw new ErroDaMeta('O Instagram não devolveu o identificador da mídia.');
  }

  // **Imagem também espera.** A espera era só para vídeo, com a suposição de
  // que foto está pronta na hora — e não está: a Meta **baixa** o arquivo da
  // URL e processa, e publicar antes disso devolve
  // `The media is not ready for publishing, please wait for a moment`.
  //
  // O erro é traiçoeiro porque depende de tempo: com a mídia já no cache da
  // Meta ele não acontece, então o mesmo conteúdo publicado duas vezes falha
  // na primeira e passa na segunda. Foi assim na primeira publicação real.
  await esperarProcessamento(container.id, token, ehVideo);

  const publicado = await chamar(`${GRAPH}/${accountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  });

  return publicado.id;
};

/**
 * Espera a Meta terminar de baixar e processar a mídia.
 *
 * Os orçamentos são diferentes porque os tempos são: foto costuma ficar
 * pronta em um ou dois segundos, vídeo leva dezenas. Nenhum dos dois pode
 * passar do tempo da função serverless — estourar ali é o pior desfecho
 * possível, porque o post pode ter saído e a fila não fica sabendo.
 *
 * O intervalo começa curto e cresce: no caso comum a primeira ou a segunda
 * consulta já responde `FINISHED`, e quem precisa mesmo esperar não gasta uma
 * chamada por segundo até o fim.
 */
const ESPERA_IMAGEM_MS = 20_000;
const ESPERA_VIDEO_MS = 40_000;

const esperarProcessamento = async (
  containerId: string,
  token: string,
  ehVideo: boolean
): Promise<void> => {
  const ateQuando = Date.now() + (ehVideo ? ESPERA_VIDEO_MS : ESPERA_IMAGEM_MS);
  const oQueE = ehVideo ? 'O vídeo' : 'A imagem';
  let intervalo = 700;

  while (Date.now() < ateQuando) {
    const estado = await chamar(
      `${GRAPH}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`
    );

    if (estado.status_code === 'FINISHED') return;
    if (estado.status_code === 'ERROR') {
      // `status` traz o motivo quando existe — costuma nomear o formato ou o
      // tamanho recusado, que é o que resolve o problema de quem está olhando.
      throw new ErroDaMeta(
        estado.status
          ? `O Instagram recusou a mídia: ${String(estado.status).slice(0, 200)}`
          : `O Instagram não conseguiu processar ${ehVideo ? 'o vídeo' : 'a imagem'}.`
      );
    }
    if (estado.status_code === 'EXPIRED') {
      throw new ErroDaMeta('A mídia expirou antes de ser publicada. Tente de novo.');
    }

    await new Promise((r) => setTimeout(r, intervalo));
    intervalo = Math.min(intervalo * 2, 4000);
  }

  throw new ErroDaMeta(
    `${oQueE} não ficou pronta a tempo no Instagram. O arquivo pode estar grande ou a URL lenta — tente de novo.`
  );
};
