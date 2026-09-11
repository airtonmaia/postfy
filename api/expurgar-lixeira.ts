import {
  clienteDeServico,
  clienteDoUsuario,
  usuarioDaRequisicao,
  json,
  naoAutenticado,
  falharComSeguranca,
  textoValido,
  autorizadoPeloCron,
} from './_lib/auth.js';
import { rota } from './_lib/rota.js';
import { apagarAgenciaDeVez } from './_lib/lixeira.js';

/**
 * Apagar agência de vez, nos dois caminhos que levam até isso.
 *
 * GET com o segredo do cron  → varre a lixeira e apaga o que passou dos 7 dias
 * POST com sessão de admin   → apaga uma agência específica, sem esperar
 *
 * Eram duas rotas. Viraram uma porque o plano Hobby da Vercel limita 12
 * funções serverless por deploy, e a branch chegou a 14 — o deploy inteiro
 * falha, sem relação com o código. É a mesma família da armadilha do cron de
 * 5 minutos no `vercel.json`: limite de plano que o CI não enxerga e que
 * derruba tudo.
 *
 * Juntar as duas não custou nada em clareza: elas já chamavam a mesma
 * `apagarAgenciaDeVez`, e a diferença sempre foi só quem autoriza e quantas
 * agências entram de uma vez.
 *
 * O cron roda pelo GitHub, não pela Vercel — contas Hobby só aceitam
 * agendamento diário. Ver `.github/workflows/expurgar-lixeira.yml`.
 */

const LOTE = 5;
const DIAS_NA_LIXEIRA = 7;

/** A varredura diária: quem passou dos 7 dias vai embora. */
async function varrer(): Promise<Response> {
  const supabase = clienteDeServico();
  if (!supabase) {
    return json(
      { error: 'Expurgo não configurado. Defina SUPABASE_SECRET_KEY.', code: 'NOT_CONFIGURED' },
      503
    );
  }

  const limite = new Date(Date.now() - DIAS_NA_LIXEIRA * 24 * 60 * 60_000).toISOString();

  const { data: vencidas, error } = await supabase
    .from('workspaces')
    .select('id, name')
    .not('deleted_at', 'is', null)
    .lte('deleted_at', limite)
    .order('deleted_at')
    .limit(LOTE);

  if (error) {
    console.error('[expurgar-lixeira] busca', error.message);
    return json({ error: 'Não foi possível ler a lixeira.' }, 500);
  }

  if (!vencidas || vencidas.length === 0) {
    return json({ apagadas: 0 });
  }

  const resultados: { id: string; ok: boolean; arquivosApagados?: number; detalhe?: string }[] = [];

  for (const ws of vencidas) {
    try {
      const { arquivosApagados } = await apagarAgenciaDeVez(supabase, ws.id);
      resultados.push({ id: ws.id, ok: true, arquivosApagados });
    } catch (erro) {
      // Não apaga a linha quando o R2 falha — ela continua vencida e entra
      // de novo na próxima passada, amanhã. Uma tentativa não vai embora
      // sem sucesso nem fica presa para sempre: só espera a próxima rodada.
      const motivo = erro instanceof Error ? erro.message : 'Falha desconhecida.';
      console.error('[expurgar-lixeira]', ws.id, ws.name, motivo);
      resultados.push({ id: ws.id, ok: false, detalhe: motivo });
    }
  }

  return json({
    apagadas: resultados.filter((r) => r.ok).length,
    falhas: resultados.filter((r) => !r.ok).length,
    resultados,
  });
}

/**
 * Exclusão imediata, pulando a espera. Só o admin da plataforma.
 *
 * Exige que a agência **já esteja na lixeira**. Apagar de vez a partir do
 * estado ativo pularia o passo em que alguém teve a chance de se arrepender
 * — mover para a lixeira primeiro é o que torna isto uma decisão em duas
 * etapas, e não um botão que apaga tudo com um clique.
 */
async function excluirUma(request: Request): Promise<Response> {
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

    if (erroAdmin) return falharComSeguranca('expurgar-lixeira/admin', erroAdmin, 500);
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

    if (erroConsulta) return falharComSeguranca('expurgar-lixeira/consulta', erroConsulta, 500);
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
    return falharComSeguranca('expurgar-lixeira/excluir', erro);
  }
}

async function handler(request: Request): Promise<Response> {
  // O cron vem primeiro: ele chega sem sessão do Supabase, e `usuarioDaRequisicao`
  // leria o mesmo header `Authorization` como se fosse um JWT.
  if (autorizadoPeloCron(request)) return varrer();

  if (request.method === 'POST') return excluirUma(request);

  return json({ error: 'Não autorizado.' }, 401);
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
