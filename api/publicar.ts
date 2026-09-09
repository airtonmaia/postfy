import { clienteDeServico, json } from './_lib/auth';
import { rota } from './_lib/rota';
import { publicarNoInstagram, ErroDaMeta } from './_lib/meta';


/**
 * Publicador da fila. Roda por cron, não por clique.
 *
 * Percorre o que está vencido e pendente, publica e registra o resultado.
 * A fila existe justamente para isto ser observável: dá para ver o que
 * falhou e por quê, sem depender de alguém estar com a aba aberta.
 *
 * A rota é protegida por segredo compartilhado no header, não por sessão:
 * quem chama é o agendador da Vercel, que não tem usuário. Sem o segredo
 * configurado a rota se recusa a rodar — aberta, ela publicaria no perfil
 * dos clientes a pedido de qualquer um.
 */

const LOTE = 10;
const MAX_TENTATIVAS = 3;

const autorizado = (request: Request): boolean => {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;

  // A Vercel manda o segredo no Authorization ao chamar um cron.
  const header = request.headers.get('authorization') || '';
  return header === `Bearer ${esperado}`;
};

async function handler(request: Request): Promise<Response> {
  if (!autorizado(request)) {
    // Mesma resposta para segredo errado e para segredo ausente: dizer qual
    // dos dois é ajuda quem está tentando adivinhar.
    return json({ error: 'Não autorizado.' }, 401);
  }

  const supabase = clienteDeServico();
  if (!supabase) {
    return json(
      { error: 'Publicação não configurada. Defina SUPABASE_SECRET_KEY.', code: 'NOT_CONFIGURED' },
      503
    );
  }

  const agora = new Date().toISOString();

  const { data: itens, error } = await supabase
    .from('publish_queue')
    .select('id, job_id, connection_id, attempts, workspace_id')
    .eq('status', 'pendente')
    .lte('scheduled_for', agora)
    .order('scheduled_for')
    .limit(LOTE);

  if (error) {
    console.error('[publicar] fila', error.message);
    return json({ error: 'Não foi possível ler a fila.' }, 500);
  }

  if (!itens || itens.length === 0) {
    return json({ processados: 0 });
  }

  const resultados: { id: string; ok: boolean; detalhe: string }[] = [];

  for (const item of itens) {
    // Marca antes de tentar: se a função for reiniciada no meio, o item não
    // volta para a fila e publica duas vezes no perfil do cliente. Publicar
    // duplicado é pior que não publicar.
    const { error: erroTrava } = await supabase
      .from('publish_queue')
      .update({ status: 'publicando', attempts: item.attempts + 1 })
      .eq('id', item.id)
      .eq('status', 'pendente');

    if (erroTrava) continue;

    try {
      const publicadoId = await publicarItem(supabase, item);
      await supabase
        .from('publish_queue')
        .update({
          status: 'publicado',
          external_id: publicadoId,
          published_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', item.id);

      await supabase
        .from('jobs')
        .update({ status: 'published', published_date: new Date().toISOString() })
        .eq('id', item.job_id);

      resultados.push({ id: item.id, ok: true, detalhe: publicadoId });
    } catch (erro) {
      const motivo =
        erro instanceof ErroDaMeta || erro instanceof Error
          ? erro.message
          : 'Falha desconhecida.';

      // Volta para pendente enquanto houver tentativa sobrando. Depois disso
      // fica em falhou, com o motivo à vista, em vez de repetir para sempre.
      const esgotou = item.attempts + 1 >= MAX_TENTATIVAS;
      await supabase
        .from('publish_queue')
        .update({ status: esgotou ? 'falhou' : 'pendente', last_error: motivo })
        .eq('id', item.id);

      resultados.push({ id: item.id, ok: false, detalhe: motivo });
    }
  }

  return json({
    processados: resultados.length,
    publicados: resultados.filter((r) => r.ok).length,
    falhas: resultados.filter((r) => !r.ok).length,
  });
}

const publicarItem = async (supabase: any, item: any): Promise<string> => {
  const { data: conexao } = await supabase
    .from('social_connections')
    .select('platform, account_id')
    .eq('id', item.connection_id)
    .maybeSingle();

  if (!conexao) throw new Error('A conta conectada não existe mais.');
  if (conexao.platform !== 'instagram') {
    throw new Error(`Publicação em ${conexao.platform} ainda não implementada.`);
  }

  const { data: token } = await supabase
    .from('social_tokens')
    .select('access_token')
    .eq('connection_id', item.connection_id)
    .maybeSingle();

  if (!token?.access_token) throw new Error('Conexão sem token. Reconecte a conta.');

  const { data: job } = await supabase
    .from('jobs')
    .select('title, caption, media_urls, hashtags')
    .eq('id', item.job_id)
    .maybeSingle();

  if (!job) throw new Error('O conteúdo não existe mais.');

  const midia = (job.media_urls || [])[0];
  if (!midia) throw new Error('O conteúdo não tem mídia para publicar.');
  if (midia.startsWith('data:')) {
    throw new Error('A mídia precisa estar numa URL pública, não embutida.');
  }

  const legenda = [job.caption || job.title, (job.hashtags || []).join(' ')]
    .filter(Boolean)
    .join('\n\n');

  return publicarNoInstagram(conexao.account_id, token.access_token, midia, legenda);
};

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
