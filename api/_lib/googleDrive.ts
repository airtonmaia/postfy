/**
 * O Google Drive **da agência**, conectado uma vez e usado sempre.
 *
 * ### Por que o fluxo mudou de lado
 *
 * A primeira versão pedia o token no navegador, com a janela do Google
 * abrindo a cada peça. Funciona e cobra caro no uso: quem monta dez posts
 * numa tarde autoriza dez vezes, e a janela aparece no meio do trabalho.
 *
 * Token que dura precisa de **refresh token**, e refresh token só vem pelo
 * fluxo de código — que exige o `client_secret`. Segredo não vai para o
 * bundle, então a troca acontece aqui, no servidor, como já acontece com o
 * Instagram e o Facebook.
 *
 * ### `access_type=offline` e `prompt=consent` andam juntos
 *
 * Sem `access_type=offline` o Google **não devolve refresh token**, e a
 * conexão morre em uma hora — sem erro, e longe de quem conectou. E sem
 * `prompt=consent` ele só o devolve na **primeira** autorização daquela
 * conta: reconectar depois de um problema traria uma resposta sem refresh
 * token, e a tela diria "conectado" sobre uma conexão que não sobrevive à
 * primeira hora.
 *
 * ### O escopo continua sendo `drive.file`
 *
 * Acesso só aos arquivos escolhidos no seletor, um a um: escopo não
 * sensível, sem o processo de verificação do Google. `userinfo.email` entra
 * para a tela poder dizer **qual conta** está conectada — sem isso, "Drive
 * conectado" não diz de quem, e a agência que conectar a conta errada só
 * descobre quando não acha os arquivos.
 */

const AUTORIZAR = 'https://accounts.google.com/o/oauth2/v2/auth';
const TROCA = 'https://oauth2.googleapis.com/token';
const USUARIO = 'https://www.googleapis.com/oauth2/v3/userinfo';

export const ESCOPOS_DRIVE = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export class ErroDoGoogle extends Error {
  status: number;
  constructor(mensagem: string, status = 502) {
    super(mensagem);
    this.name = 'ErroDoGoogle';
    this.status = status;
  }
}

/**
 * As credenciais do servidor.
 *
 * Aceita o nome com `VITE_` porque foi assim que a primeira versão pediu, e
 * na Vercel a variável do bundle também existe no ambiente da função. Trocar
 * o nome cadastrado por causa de um prefixo seria trabalho de quem configura
 * para ganho nenhum — o que **não** pode ter `VITE_` é o segredo, e ele não
 * tem.
 */
export const credenciaisDoGoogle = (): { id?: string; segredo?: string } => ({
  id: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID,
  segredo: process.env.GOOGLE_CLIENT_SECRET,
});

export const urlDeAutorizacao = (
  clientId: string,
  redirectUri: string,
  estado: string
): string =>
  `${AUTORIZAR}?client_id=${encodeURIComponent(clientId)}` +
  `&redirect_uri=${encodeURIComponent(redirectUri)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(ESCOPOS_DRIVE)}` +
  // Sem os dois, não há refresh token — e a conexão "permanente" dura uma
  // hora. Ver o cabeçalho.
  `&access_type=offline` +
  `&prompt=consent` +
  `&include_granted_scopes=true` +
  `&state=${encodeURIComponent(estado)}`;

const pedir = async (corpo: Record<string, string>): Promise<any> => {
  const resposta = await fetch(TROCA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(corpo).toString(),
  });

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    // A mensagem do Google vai para o log; ao cliente volta algo curto. O
    // corpo de erro às vezes ecoa o token.
    console.error('[google]', resposta.status, String(dados?.error_description || '').slice(0, 200));
    throw new ErroDoGoogle('O Google recusou a autorização.');
  }
  return dados;
};

export const trocarCodigoPorToken = async (
  codigo: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<{ acesso: string; renovacao?: string; expiraEm: number }> => {
  const dados = await pedir({
    code: codigo,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  return {
    acesso: dados.access_token,
    renovacao: dados.refresh_token,
    expiraEm: typeof dados.expires_in === 'number' ? dados.expires_in : 3600,
  };
};

export const renovarAcesso = async (
  renovacao: string,
  clientId: string,
  clientSecret: string
): Promise<{ acesso: string; expiraEm: number }> => {
  const dados = await pedir({
    refresh_token: renovacao,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  return {
    acesso: dados.access_token,
    expiraEm: typeof dados.expires_in === 'number' ? dados.expires_in : 3600,
  };
};

/**
 * De quem é a conta conectada.
 *
 * Não lança: a conexão não pode falhar porque o e-mail não veio. Sem ele a
 * tela mostra que está conectado e não diz de quem — pior que ter o e-mail,
 * melhor que não conectar.
 */
export const emailDaConta = async (acesso: string): Promise<string | null> => {
  try {
    const resposta = await fetch(USUARIO, { headers: { Authorization: `Bearer ${acesso}` } });
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    return typeof dados.email === 'string' ? dados.email : null;
  } catch {
    return null;
  }
};

const DRIVE = 'https://www.googleapis.com/drive/v3';

/**
 * Libera o arquivo por link, para o player do Drive tocar no portal.
 *
 * ### O que se ganha, e o que se paga
 *
 * O portal do cliente é anônimo: para ele assistir a um vídeo, ou o arquivo
 * vem do nosso balde — e aí o celular dele baixa os 109 MB do original — ou
 * o Google serve, e o Google **transcodifica**: o player dele escolhe a
 * resolução pela conexão, como o YouTube. Numa aprovação pelo celular, essa
 * diferença é a conta do mês de alguém.
 *
 * O preço é explícito: enquanto a permissão existe, **qualquer pessoa com o
 * endereço do arquivo assiste**, dentro ou fora do portal. O id aparece no
 * código da página, então na prática o alcance é "quem consegue abrir o
 * portal daquele cliente". Foi uma escolha feita sabendo disso, e por isso a
 * liberação é **retirada** quando a peça sai de aprovação.
 *
 * `drive.file` alcança permissões dos arquivos que o app recebeu pelo
 * seletor — não é preciso escopo mais largo, que é o que obrigaria à
 * verificação do Google.
 *
 * Não lança: sem a liberação o portal cai na capa parada, que é o que ele
 * mostrava antes. Derrubar a criação da peça por causa disso seria trocar o
 * essencial pelo acessório.
 */
export const liberarPorLink = async (fileId: string, acesso: string): Promise<boolean> => {
  try {
    const resposta = await fetch(
      `${DRIVE}/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${acesso}`,
          'Content-Type': 'application/json',
        },
        // `reader`, nunca `writer`: o cliente assiste, não mexe no arquivo.
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      }
    );

    return resposta.ok;
  } catch {
    return false;
  }
};

/**
 * Retira a liberação por link.
 *
 * A permissão de `anyone` tem id fixo `anyoneWithLink`, então não é preciso
 * listar antes. Um 404 aqui é bom: significa que já não havia liberação.
 *
 * **Sem isto, a exposição seria permanente** — e o que justifica a liberação
 * é ela durar o tempo da aprovação.
 */
export const trancarPorLink = async (fileId: string, acesso: string): Promise<boolean> => {
  try {
    const resposta = await fetch(
      `${DRIVE}/files/${encodeURIComponent(fileId)}/permissions/anyoneWithLink` +
        '?supportsAllDrives=true',
      { method: 'DELETE', headers: { Authorization: `Bearer ${acesso}` } }
    );

    return resposta.ok || resposta.status === 404;
  } catch {
    return false;
  }
};
