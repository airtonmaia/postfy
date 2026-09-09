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
import { ESCOPOS_META } from './_lib/meta.js';


/**
 * Início do OAuth com a Meta.
 *
 * Devolve a URL para onde o navegador deve ir. Não redireciona daqui porque
 * a chamada vem de um fetch autenticado: o redirect morreria no XHR.
 *
 * O `state` carrega a agência e vai assinado. Sem assinatura, alguém poderia
 * trocar o id no meio do caminho e ligar a conta de Instagram do próprio
 * perfil a uma agência alheia — que é o modo clássico de sequestrar uma
 * conexão OAuth.
 */

const SEGREDO_DO_ESTADO = () => process.env.OAUTH_STATE_SECRET || process.env.CRON_SECRET || '';

export const assinarEstado = (dados: string, segredo: string): string =>
  createHmac('sha256', segredo).update(dados).digest('base64url');

export const montarEstado = (workspaceId: string, userId: string, segredo: string): string => {
  const corpo = `${workspaceId}.${userId}.${Date.now()}`;
  return `${Buffer.from(corpo).toString('base64url')}.${assinarEstado(corpo, segredo)}`;
};

/** Devolve os dados do estado, ou null se a assinatura não confere. */
export const conferirEstado = (
  estado: string,
  segredo: string,
  validadeMs = 15 * 60_000
): { workspaceId: string; userId: string } | null => {
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

  const [workspaceId, userId, emissao] = corpo.split('.');
  if (!workspaceId || !userId || !emissao) return null;
  if (Date.now() - Number(emissao) > validadeMs) return null;

  return { workspaceId, userId };
};

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  const usuario = await usuarioDaRequisicao(request);
  if (!usuario) return naoAutenticado();

  const appId = process.env.META_APP_ID;
  const segredo = SEGREDO_DO_ESTADO();

  if (!appId || !process.env.META_APP_SECRET || !segredo) {
    return json(
      {
        error:
          'Conexão com redes sociais não configurada. Defina META_APP_ID, META_APP_SECRET e OAUTH_STATE_SECRET.',
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

  const { workspaceId } = corpo || {};
  if (!textoValido(workspaceId, 64)) {
    return json({ error: 'Agência não informada.' }, 400);
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

    const base = process.env.APP_URL || 'https://app.orquesia.com.br';
    const redirectUri = `${base}/api/social-callback`;
    const estado = montarEstado(workspaceId, usuario.id, segredo);

    const url =
      `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(ESCOPOS_META)}` +
      `&state=${encodeURIComponent(estado)}` +
      `&response_type=code`;

    return json({ url });
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
