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
import { apagarAgenciaDeVez } from './_lib/lixeira.js';

/**
 * Exclusão imediata, pulando os 7 dias da lixeira. Só o admin da plataforma.
 *
 * O expurgo diário (`api/expurgar-lixeira.ts`) só alcança quem já está na
 * lixeira há uma semana. Esta rota existe para o caso de suporte: uma
 * agência de teste que o próprio dono do produto criou para experimentar um
 * plano, e quer sumir agora — não daqui sete dias.
 *
 * Exige que a agência já esteja na lixeira. Excluir de vez a partir do
 * estado ativo pularia o passo em que alguém teve a chance de se arrepender
 * — mover para a lixeira primeiro é o que torna isto uma decisão em duas
 * etapas, e não um botão que apaga tudo com um clique.
 */
async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  const usuario = await usuarioDaRequisicao(request);
  if (!usuario) return naoAutenticado();

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
    // A RLS de platform_admins só deixa um admin enxergar a própria linha:
    // para qualquer outro a consulta volta vazia, que é exatamente a
    // resposta. O admin da plataforma não precisa ser membro da agência que
    // está apagando — é justamente o caso comum aqui.
    const supabaseDoUsuario = clienteDoUsuario(request);
    const { data: admin, error: erroAdmin } = await supabaseDoUsuario
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', usuario.id)
      .maybeSingle();

    if (erroAdmin) return falharComSeguranca('excluir-agencia/admin', erroAdmin, 500);
    if (!admin) {
      return json({ error: 'Só o administrador da plataforma pode excluir sem esperar.' }, 403);
    }

    const supabase = clienteDeServico();
    if (!supabase) {
      return json(
        { error: 'Exclusão não configurada. Defina SUPABASE_SECRET_KEY.', code: 'NOT_CONFIGURED' },
        503
      );
    }

    const { data: agencia, error: erroConsulta } = await supabase
      .from('workspaces')
      .select('id, deleted_at')
      .eq('id', workspaceId)
      .maybeSingle();

    if (erroConsulta) return falharComSeguranca('excluir-agencia/consulta', erroConsulta, 500);
    if (!agencia) {
      // Já não existe — não é erro, é o estado que a pessoa queria.
      return json({ ok: true, arquivosApagados: 0 });
    }
    if (!agencia.deleted_at) {
      return json(
        { error: 'A agência precisa estar na lixeira antes de ser excluída sem esperar.' },
        409
      );
    }

    const { arquivosApagados } = await apagarAgenciaDeVez(supabase, workspaceId);
    return json({ ok: true, arquivosApagados });
  } catch (erro) {
    return falharComSeguranca('excluir-agencia', erro);
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
