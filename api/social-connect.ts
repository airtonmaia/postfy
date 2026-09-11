import { createHmac, timingSafeEqual } from 'node:crypto';
import { rota } from './_lib/rota.js';
import {
  usuarioDaRequisicao,
  clienteDoUsuario,
  json,
  naoAutenticado,
  falharComSeguranca,
  textoValido,
} from './_lib/auth.js';
import { urlDeAutorizacao } from './_lib/instagram.js';


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
  clientId?: string
): string => {
  const corpo = `${workspaceId}.${userId}.${Date.now()}.${clientId ?? ''}`;
  return `${Buffer.from(corpo).toString('base64url')}.${assinarEstado(corpo, segredo)}`;
};

/** Devolve os dados do estado, ou null se a assinatura não confere. */
export const conferirEstado = (
  estado: string,
  segredo: string,
  validadeMs = 15 * 60_000
): { workspaceId: string; userId: string; clientId?: string } | null => {
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

  const [workspaceId, userId, emissao, clientId] = corpo.split('.');
  if (!workspaceId || !userId || !emissao) return null;
  if (Date.now() - Number(emissao) > validadeMs) return null;

  // Um corpo de três campos é um estado emitido antes de o cliente existir
  // aqui. Continua válido — vira conexão da agência, sem cliente.
  return { workspaceId, userId, clientId: clientId || undefined };
};

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  const usuario = await usuarioDaRequisicao(request);
  if (!usuario) return naoAutenticado();

  const appId = process.env.INSTAGRAM_APP_ID;
  const segredo = SEGREDO_DO_ESTADO();

  if (!appId || !process.env.INSTAGRAM_APP_SECRET || !segredo) {
    return json(
      {
        error:
          'Conexão com o Instagram não configurada. Defina INSTAGRAM_APP_ID, ' +
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
    const estado = montarEstado(workspaceId, usuario.id, segredo, clientId || undefined);

    // `www.instagram.com/oauth/authorize`, e não o diálogo do Facebook: a
    // conta que autoriza é a do Instagram, sem Página no caminho.
    const url = urlDeAutorizacao(appId, redirectUri, estado);

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
