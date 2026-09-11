import { clienteDeServico, json, autorizadoPeloCron } from './_lib/auth.js';
import { rota } from './_lib/rota.js';
import { publicarNoInstagram, renovarToken, ErroDaMeta } from './_lib/instagram.js';
import { esvaziarFilaDeEmail } from './_lib/emails.js';


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

/**
 * Quantos itens a consulta busca por passada.
 *
 * Teto de segurança, não meta: quem decide de verdade quantos são
 * publicados é o `ORCAMENTO_MS` abaixo. Buscar mais do que dá tempo custa
 * uma consulta um pouco maior e nada mais.
 */
const LOTE = 40;

/**
 * Orçamento de tempo da passada.
 *
 * Cada publicação são duas ou três chamadas à API do Instagram, e o tempo
 * delas não é nosso — varia com o tamanho da mídia e com o dia da Meta. Um
 * `LOTE` fixo só funciona se a estimativa estiver certa: alto demais estoura
 * o tempo da função e **perde o registro do que já foi publicado** (pior
 * desfecho possível: a peça vai ao ar e a fila não sabe), baixo demais
 * segura a fila na hora do pico — e todo mundo agenda para 9h e 18h.
 *
 * Com orçamento, a passada publica o que couber e para. O que sobrou é o
 * primeiro da próxima, cinco minutos depois. Cresce com o produto sem
 * ninguém mexer no número.
 *
 * 45s numa função de 60s: sobra folga para o item em andamento terminar e
 * para a resposta ser escrita.
 */
const ORCAMENTO_MS = 45_000;

const MAX_TENTATIVAS = 3;

async function handler(request: Request): Promise<Response> {
  if (!autorizadoPeloCron(request)) {
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

  // Renovar vem antes de publicar, e não depois: um token vencido faz a
  // publicação falhar, gastar tentativa e só então alguém descobrir.
  const renovadas = await renovarTokensQuePodemVencer(supabase);

  // A fila de e-mail pega carona nesta passada, e não numa rota própria: o
  // plano Hobby da Vercel aceita 12 funções e já estamos em 12 (armadilha
  // 6). As duas filas são a mesma ideia — o navegador enfileira, o cron
  // esvazia —, e de cinco em cinco minutos é tempo de sobra para um e-mail
  // de aviso.
  //
  // Antes do resto de propósito: é a parte barata, e se a publicação
  // estourar no meio o e-mail já saiu.
  const email = await esvaziarFilaDeEmail(supabase);

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
    return json({ processados: 0, renovadas, email });
  }

  const resultados: { id: string; ok: boolean; detalhe: string }[] = [];
  const comecou = Date.now();
  let adiados = 0;

  for (const item of itens) {
    // Fim do orçamento: o resto fica pendente e é o primeiro da próxima
    // passada. Parar aqui é de propósito — estourar o tempo da função no meio
    // de uma publicação deixa a peça no ar sem a fila saber.
    if (Date.now() - comecou > ORCAMENTO_MS) {
      adiados = itens.length - resultados.length;
      break;
    }

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
    // Quantos ficaram para a próxima passada. Diferente de zero de forma
    // seguida significa que cinco minutos já não bastam — é o sinal de que
    // chegou a hora de encurtar o cron ou dividir a fila.
    adiados,
    renovadas,
    email,
  });
}

/**
 * Mantém as conexões vivas.
 *
 * O token do Instagram vale 60 dias. Sem renovar, a conexão de uma agência
 * que ficou dois meses sem publicar simplesmente para de funcionar — e o
 * sintoma é a publicação agendada falhando de madrugada, não um aviso.
 *
 * Roda em toda passada do agendador e olha **todas** as conexões, não só as
 * que têm item na fila: é justamente quem não publica há tempos que corre o
 * risco. A Meta só renova token com mais de 24 horas, e a margem de 10 dias
 * dá quase duas semanas de tentativas antes de a conta cair.
 */
const MARGEM_DE_RENOVACAO_MS = 10 * 24 * 60 * 60_000;

const renovarTokensQuePodemVencer = async (supabase: any): Promise<number> => {
  const limite = new Date(Date.now() + MARGEM_DE_RENOVACAO_MS).toISOString();

  const { data: conexoes, error } = await supabase
    .from('social_connections')
    .select('id, account_name')
    .eq('platform', 'instagram')
    .not('expires_at', 'is', null)
    .lte('expires_at', limite)
    .limit(LOTE);

  if (error || !conexoes?.length) return 0;

  let renovadas = 0;
  for (const conexao of conexoes) {
    try {
      const { data: guardado } = await supabase
        .from('social_tokens')
        .select('access_token')
        .eq('connection_id', conexao.id)
        .maybeSingle();

      if (!guardado?.access_token) continue;

      const { token, expiraEm } = await renovarToken(guardado.access_token);

      await supabase
        .from('social_tokens')
        .update({ access_token: token, updated_at: new Date().toISOString() })
        .eq('connection_id', conexao.id);

      await supabase
        .from('social_connections')
        .update({
          expires_at: expiraEm
            ? new Date(Date.now() + expiraEm * 1000).toISOString()
            : null,
        })
        .eq('id', conexao.id);

      renovadas++;
    } catch (erro) {
      // Uma conexão que não renova não pode derrubar a passada inteira: as
      // outras ainda têm publicação para fazer. O `expires_at` continua
      // vencendo, e a tela de Integrações mostra isso.
      console.error(
        '[publicar] renovação',
        conexao.account_name,
        erro instanceof Error ? erro.message : erro
      );
    }
  }
  return renovadas;
};

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
