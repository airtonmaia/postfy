import { createHmac, timingSafeEqual } from 'node:crypto';
import { rota } from './_lib/rota.js';
import {
  usuarioDaRequisicao,
  clienteDoUsuario,
  clienteDeServico,
  json,
  naoAutenticado,
  falharComSeguranca,
  textoValido,
} from './_lib/auth.js';
import { urlDeAutorizacao } from './_lib/instagram.js';
import { urlDeAutorizacao as urlDoFacebook } from './_lib/facebook.js';
import {
  urlDeAutorizacao as urlDoDrive,
  credenciaisDoGoogle,
  renovarAcesso,
} from './_lib/googleDrive.js';


/**
 * Início do OAuth com o Instagram.
 *
 * Devolve a URL para onde o navegador deve ir. Não redireciona daqui porque
 * a chamada vem de um fetch autenticado: o redirect morreria no XHR.
 *
 * O `state` carrega a agência e vai assinado. Sem assinatura, alguém poderia
 * trocar o id no meio do caminho e ligar a conta de Instagram do próprio
 * perfil a uma agência alheia — que é o modo clássico de sequestrar uma
 * conexão OAuth.
 *
 * As credenciais são as do **app do Instagram** (Instagram → Configuração da
 * API), que não são as do app da Meta. Ver o comentário longo em
 * `api/_lib/instagram.ts`.
 */

const SEGREDO_DO_ESTADO = () => process.env.OAUTH_STATE_SECRET || process.env.CRON_SECRET || '';

export const assinarEstado = (dados: string, segredo: string): string =>
  createHmac('sha256', segredo).update(dados).digest('base64url');

/**
 * O cliente viaja no estado, e não num parâmetro à parte do retorno.
 *
 * `social_connections.client_id` existia no schema desde o começo e **ninguém
 * escrevia** — toda conexão nascia com o cliente nulo. O efeito era pior que
 * uma coluna vazia: sem saber de quem é a conta, o agendador não tem como
 * escolher em qual perfil publicar, e a fila nunca recebia nada.
 *
 * Vai aqui dentro porque o que o navegador manda de volta no retorno não é
 * confiável: quem chega em `social-callback` veio da Meta, sem sessão. Um
 * `clientId` na query seria escolhido por quem quisesse, e publicaria o
 * conteúdo de um cliente no perfil de outro.
 */
export const montarEstado = (
  workspaceId: string,
  userId: string,
  segredo: string,
  clientId?: string,
  /**
   * Qual fluxo de OAuth está em curso.
   *
   * Vai **dentro do estado assinado**, e não na query do retorno, pela mesma
   * razão que o cliente vai: quem chega em `social-callback` veio da Meta, sem
   * sessão. Uma `rede` escolhida na URL faria o retorno do Instagram ser
   * trocado pelo do Facebook — e as duas trocas de código batem em endpoints
   * diferentes, com segredos de apps diferentes.
   */
  rede: 'instagram' | 'facebook' | 'google_drive' = 'instagram'
): string => {
  const corpo = `${workspaceId}.${userId}.${Date.now()}.${clientId ?? ''}.${rede}`;
  return `${Buffer.from(corpo).toString('base64url')}.${assinarEstado(corpo, segredo)}`;
};

/** Devolve os dados do estado, ou null se a assinatura não confere. */
export const conferirEstado = (
  estado: string,
  segredo: string,
  validadeMs = 15 * 60_000
): {
  workspaceId: string;
  userId: string;
  clientId?: string;
  rede: 'instagram' | 'facebook' | 'google_drive';
} | null => {
  const [corpoB64, assinatura] = estado.split('.');
  if (!corpoB64 || !assinatura) return null;

  let corpo: string;
  try {
    corpo = Buffer.from(corpoB64, 'base64url').toString();
  } catch {
    return null;
  }

  const esperada = Buffer.from(assinarEstado(corpo, segredo));
  const recebida = Buffer.from(assinatura);
  // Comparação em tempo constante: com `===`, o tempo de resposta vaza quantos
  // caracteres iniciais estavam certos.
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;

  const [workspaceId, userId, emissao, clientId, redeCrua] = corpo.split('.');
  // Estado antigo, emitido antes do Facebook existir, não tem o campo. Ele
  // continua valendo por 15 minutos depois do deploy, e cai no Instagram —
  // que era a única rede quando ele foi assinado.
  const rede =
    redeCrua === 'facebook' ? 'facebook' : redeCrua === 'google_drive' ? 'google_drive' : 'instagram';
  if (!workspaceId || !userId || !emissao) return null;
  if (Date.now() - Number(emissao) > validadeMs) return null;

  // Um corpo de três campos é um estado emitido antes de o cliente existir
  // aqui. Continua válido — vira conexão da agência, sem cliente.
  return { workspaceId, userId, clientId: clientId || undefined, rede };
};

/**
 * Um token de acesso ao Drive da agência, para a aba usar por uma hora.
 *
 * **O refresh token nunca sai daqui.** Ele é o que dá acesso continuado à
 * conta do Google de quem conectou; no navegador, viraria acesso permanente
 * para quem abrisse o console. O que a aba recebe é o token curto, com
 * escopo `drive.file` — e `drive.file` só alcança os arquivos escolhidos no
 * seletor, um a um.
 *
 * O token guardado é reaproveitado enquanto vale: sem isso, cada peça pediria
 * um novo ao Google, e o limite de renovações por conta é real.
 */
const MARGEM_DO_TOKEN_MS = 2 * 60_000;

const tokenDoDrive = async (
  request: Request,
  userId: string,
  workspaceId: unknown
): Promise<Response> => {
  if (!textoValido(workspaceId, 64)) {
    return json({ error: 'Agência não informada.' }, 400);
  }

  const { id, segredo: segredoDoGoogle } = credenciaisDoGoogle();
  if (!id || !segredoDoGoogle) {
    return json(
      {
        error:
          'Google Drive não configurado no servidor. Defina GOOGLE_CLIENT_ID e ' +
          'GOOGLE_CLIENT_SECRET.',
        code: 'DRIVE_NOT_CONFIGURED',
      },
      503
    );
  }

  // Membro basta: escolher a arte é trabalho de quem produz. Conectar e
  // desconectar é que são de quem administra.
  const doUsuario = clienteDoUsuario(request);
  const { data: membro } = await doUsuario
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membro) return json({ error: 'Você não pertence a esta agência.' }, 403);

  const supabase = clienteDeServico();
  if (!supabase) {
    return json({ error: 'Armazenamento de credenciais não configurado.' }, 503);
  }

  const { data: credencial } = await supabase
    .from('drive_credenciais')
    .select('refresh_token, access_token, expira_em')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (!credencial?.refresh_token) {
    return json(
      {
        error:
          'Esta agência ainda não conectou um Google Drive. Faça isso em ' +
          'Configurações → Integrações.',
        code: 'DRIVE_SEM_CONEXAO',
      },
      409
    );
  }

  const aindaVale =
    credencial.access_token &&
    credencial.expira_em &&
    new Date(credencial.expira_em).getTime() - MARGEM_DO_TOKEN_MS > Date.now();

  /**
   * O id do projeto vai junto, e ele é obrigatório no seletor.
   *
   * Com escopo `drive.file`, o Google só registra a concessão do arquivo
   * escolhido quando o seletor é construído com o id do projeto. Sem ele a
   * escolha acontece e **toda leitura depois volta 404** — a miniatura, e a
   * cópia na hora de agendar, já com a data marcada.
   *
   * Derivado do `client_id` em vez de uma variável nova: o id do projeto é o
   * número antes do hífen, e mais uma variável é mais uma coisa para
   * cadastrar errado.
   */
  const appId = id.split('-')[0];

  if (aindaVale) return json({ token: credencial.access_token, appId });

  try {
    const { acesso, expiraEm } = await renovarAcesso(credencial.refresh_token, id, segredoDoGoogle);

    await supabase
      .from('drive_credenciais')
      .update({
        access_token: acesso,
        expira_em: new Date(Date.now() + expiraEm * 1000).toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId);

    return json({ token: acesso, appId });
  } catch {
    /*
      O refresh token morreu — a pessoa revogou o acesso na conta dela, ou o
      app foi removido. A tela precisa dizer isso com o que fazer, senão o
      seletor simplesmente não abre e ninguém sabe por quê.
    */
    return json(
      {
        error:
          'A autorização do Google Drive expirou ou foi revogada. Reconecte em ' +
          'Configurações → Integrações.',
        code: 'DRIVE_EXPIRADO',
      },
      409
    );
  }
};

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  const usuario = await usuarioDaRequisicao(request);
  if (!usuario) return naoAutenticado();

  /**
   * Qual rede, e **credenciais separadas para cada uma**.
   *
   * `FACEBOOK_APP_ID` não é `INSTAGRAM_APP_ID`: são apps diferentes no mesmo
   * painel, e usar um no lugar do outro falha só depois de a pessoa já ter
   * digitado a senha, com uma mensagem que não nomeia a causa.
   */
  const corpoDaRede = await request.clone().json().catch(() => ({} as any));
  const rede: 'instagram' | 'facebook' | 'google_drive' =
    corpoDaRede?.rede === 'facebook'
      ? 'facebook'
      : corpoDaRede?.rede === 'google_drive'
        ? 'google_drive'
        : 'instagram';

  /**
   * **Pedir o token do Drive é um modo desta rota, não uma rota nova.**
   *
   * São 12 de 12 funções no plano Hobby, e a 13ª derruba o deploy inteiro com
   * `tsc`, vitest e build verdes (armadilha 6). E o lugar é este: aqui já
   * moram o segredo do OAuth e a conferência de quem manda na agência.
   *
   * O que a aba recebe é um token de **uma hora**, com escopo `drive.file` —
   * nunca o refresh token, que é o que dá acesso continuado e mora numa
   * tabela sem política nenhuma.
   */
  if (corpoDaRede?.acao === 'token-do-drive') {
    return await tokenDoDrive(request, usuario.id, corpoDaRede?.workspaceId);
  }

  const doGoogle = credenciaisDoGoogle();

  const appId =
    rede === 'google_drive'
      ? doGoogle.id
      : rede === 'facebook'
        ? process.env.FACEBOOK_APP_ID
        : process.env.INSTAGRAM_APP_ID;
  const appSecret =
    rede === 'google_drive'
      ? doGoogle.segredo
      : rede === 'facebook'
        ? process.env.FACEBOOK_APP_SECRET
        : process.env.INSTAGRAM_APP_SECRET;
  const segredo = SEGREDO_DO_ESTADO();

  if (!appId || !appSecret || !segredo) {
    return json(
      {
        error:
          rede === 'google_drive'
            ? 'Google Drive não configurado. Defina GOOGLE_CLIENT_ID e ' +
              'GOOGLE_CLIENT_SECRET (o segredo não leva o prefixo VITE_: ele ' +
              'nunca pode ir para o navegador).'
            : rede === 'facebook'
              ? 'Conexão com o Facebook não configurada. Defina FACEBOOK_APP_ID, ' +
                'FACEBOOK_APP_SECRET e OAUTH_STATE_SECRET. Publicar numa Página ' +
                'exige revisão do app na Meta para pages_manage_posts.'
              : 'Conexão com o Instagram não configurada. Defina INSTAGRAM_APP_ID, ' +
                'INSTAGRAM_APP_SECRET e OAUTH_STATE_SECRET. Atenção: o app id do ' +
                'Instagram não é o do app da Meta — ele fica em Instagram → ' +
                'Configuração da API.',
        code: 'SOCIAL_NOT_CONFIGURED',
      },
      503
    );
  }

  let corpo: any;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'Corpo da requisição não é um JSON válido.' }, 400);
  }

  const { workspaceId, clientId } = corpo || {};
  if (!textoValido(workspaceId, 64)) {
    return json({ error: 'Agência não informada.' }, 400);
  }
  if (clientId !== undefined && clientId !== null && !textoValido(clientId, 64)) {
    return json({ error: 'Cliente inválido.' }, 400);
  }

  try {
    // Confere pela RLS que a pessoa manda nesta agência. Conectar a conta de
    // um cliente é decisão de quem administra, não de qualquer membro.
    const supabase = clienteDoUsuario(request);
    const { data: membro, error } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', usuario.id)
      .maybeSingle();

    if (error) return falharComSeguranca('social/membership', error, 500);
    if (!membro) return json({ error: 'Você não pertence a esta agência.' }, 403);
    if (!['owner', 'admin', 'manager'].includes(membro.role)) {
      return json({ error: 'Seu perfil não pode conectar contas.' }, 403);
    }

    // O cliente é conferido aqui, com a sessão de quem pediu, e não no
    // retorno: lá não há sessão nenhuma. A RLS recorta por agência, então um
    // id de cliente de outra agência simplesmente não volta.
    if (clientId) {
      const { data: cliente, error: erroCliente } = await supabase
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (erroCliente) return falharComSeguranca('social/cliente', erroCliente, 500);
      if (!cliente) return json({ error: 'Cliente não encontrado nesta agência.' }, 404);
    }

    const base = process.env.APP_URL || 'https://app.orquesia.com.br';
    const redirectUri = `${base}/api/social-callback`;
    const estado = montarEstado(workspaceId, usuario.id, segredo, clientId || undefined, rede);

    // Dois diálogos diferentes, e os escopos de um **invalidam** a
    // autorização do outro: `pages_*` fazem a tela do Instagram recusar. Por
    // isso a escolha acontece aqui, e nunca num pedido que junte os dois.
    const url =
      rede === 'google_drive'
        ? urlDoDrive(appId, redirectUri, estado)
        : rede === 'facebook'
          ? urlDoFacebook(appId, redirectUri, estado)
          : urlDeAutorizacao(appId, redirectUri, estado);

    // A URL de redirecionamento vai junto porque ela precisa estar cadastrada
    // **igual** na Meta, e o erro de não bater só aparece depois de a pessoa
    // já ter digitado a senha. A tela de Integrações mostra qual é.
    return json({ url, redirectUri });
  } catch (erro) {
    return falharComSeguranca('social/connect', erro);
  }
}

/**
 * Handler no formato Web, exportado para os testes chamarem direto.
 * O que a Vercel executa é o default abaixo.
 */
export const POST = handler;

/**
 * Default no formato (req, res), que toda versão do builder da Vercel
 * entende. Ver o porquê em api/_lib/rota.ts.
 */
export default rota(handler);
