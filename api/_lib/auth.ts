import { createClient } from '@supabase/supabase-js';

/**
 * Autenticação das funções serverless.
 *
 * O cliente manda o access token do Supabase no header Authorization. Aqui a
 * validação é feita contra o próprio Supabase, então a função nunca confia no
 * que o navegador afirma sobre quem é o usuário.
 *
 * A chave usada é a publicável: basta para validar um token. A service_role
 * ignoraria a RLS e não é necessária em nenhuma destas rotas.
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://ietpfqqeattymgbqmonq.supabase.co';

const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_RHh5a7HrkRxos3CvubjNxg_67IEsCDo';

export interface UsuarioAutenticado {
  id: string;
  email: string;
}

export const usuarioDaRequisicao = async (
  request: Request
): Promise<UsuarioAutenticado | null> => {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email || '' };
};

/**
 * Cliente que age como o usuário: as consultas continuam sujeitas à RLS.
 * É assim que a função confirma o papel de alguém sem reimplementar a regra.
 */
export const clienteDoUsuario = (request: Request) => {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
};

/**
 * Cliente com a chave de serviço, que ignora a RLS.
 *
 * Existe por um motivo só: `social_tokens` tem RLS ligada e nenhuma política,
 * então é inalcançável por qualquer sessão autenticada — inclusive a do dono
 * da agência. É assim de propósito: um membro que lesse o token poderia
 * publicar em nome do cliente por fora do sistema, sem rastro nenhum aqui.
 *
 * A contrapartida é que este cliente enxerga tudo. Use só para o token, e
 * sempre depois de já ter confirmado a permissão com `clienteDoUsuario`, que
 * passa pela RLS. Nunca com dado vindo do navegador sem essa checagem antes.
 *
 * Devolve null quando a chave não está configurada, para a rota poder
 * responder 503 em vez de estourar.
 */
export const clienteDeServico = () => {
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) return null;

  return createClient(SUPABASE_URL, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export const json = (corpo: unknown, status = 200): Response =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });

export const naoAutenticado = () =>
  json({ error: 'Sessão expirada ou inexistente. Faça login novamente.' }, 401);

/**
 * Nunca devolvemos a mensagem crua do provedor: ela carrega detalhe de
 * infraestrutura. Loga completo, responde genérico.
 */
export const falharComSeguranca = (escopo: string, erro: unknown, status = 500): Response => {
  console.error(`[${escopo}]`, erro instanceof Error ? erro.message : erro);
  return json(
    { error: 'Não foi possível concluir a operação. Tente novamente em instantes.' },
    status
  );
};

export const textoValido = (valor: unknown, max = 2000): valor is string =>
  typeof valor === 'string' && valor.trim().length > 0 && valor.length <= max;

/**
 * Rate limit por instância. Serverless escala horizontalmente, então este
 * limite é por container, não global — freia abuso casual, não um ataque
 * distribuído. Para isso seria preciso um contador compartilhado.
 */
const janelas = new Map<string, number[]>();

export const excedeuLimite = (chave: string, max: number, janelaMs: number): boolean => {
  const agora = Date.now();
  const corte = agora - janelaMs;
  const marcas = (janelas.get(chave) || []).filter((t) => t > corte);
  if (marcas.length >= max) return true;
  marcas.push(agora);
  janelas.set(chave, marcas);
  return false;
};
