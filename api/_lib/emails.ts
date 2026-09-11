import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Montagem e envio dos e-mails automáticos do sistema.
 *
 * Saiu de `api/send-email.ts`, que era uma rota chamada pelo navegador logo
 * depois de a mudança estar gravada. Fechar a aba no meio interrompia o
 * envio: o conteúdo ficava aprovado e o e-mail não saía, sem erro em lugar
 * nenhum. Agora o navegador enfileira e quem envia é o cron — por isso este
 * código precisa viver fora de uma rota, chamável dos dois lados.
 *
 * O modelo vem do banco, nunca do corpo de uma requisição: quem define o
 * texto é o dono do SaaS pela tela de Super Admin. Se o texto pudesse vir do
 * cliente, qualquer sessão autenticada teria um remetente `@orquesia.com.br`
 * para escrever o que quisesse.
 */

const REMETENTE = process.env.RESEND_FROM || 'Orquesia <avisos@orquesia.com.br>';

export const EVENTOS_DE_EMAIL = new Set([
  'conteudo_aguardando_aprovacao',
  'conteudo_aprovado',
  'pedido_de_ajuste',
]);

const escapar = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Troca as variáveis pelo valor. O que não veio some, em vez de vazar a chave. */
const preencher = (texto: string, valores: Record<string, string>): string =>
  texto.replace(/\{\{(\w+)\}\}/g, (_, chave) => valores[chave] ?? '');

const corpoEmHtml = (texto: string, link: string): string => {
  const paragrafos = escapar(texto)
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => `<p style="margin:0 0 12px">${l}</p>`)
    .join('');

  const botao = link
    ? `<div style="text-align:center;margin:28px 0">
         <a href="${escapar(link)}"
            style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;
                   padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px">
           Visualizar
         </a>
       </div>`
    : '';

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a;line-height:1.6;font-size:14px">
    ${paragrafos}
    ${botao}
    <p style="color:#64748b;font-size:12px;margin-top:28px">Enviado automaticamente pelo Orquesia.</p>
  </div>`;
};

export interface ModeloDeEmail {
  assunto: string;
  corpo: string;
  ativo: boolean;
  destinatario: string;
}

/**
 * Para quem o modelo manda, e como escrever o link.
 *
 * Separado do envio porque quem enfileira precisa desta resposta **antes**
 * de a sessão acabar: o cron não tem como perguntar depois quem estava
 * logado.
 */
export const linkDoEmail = (destinatario: string, jobId: string): string => {
  const base = process.env.APP_URL || 'https://app.orquesia.com.br';

  // O link do cliente leva à porta do portal, não ao portal já aberto: um
  // token no e-mail dispensaria o código de verificação, e a entrada por
  // código existe justamente para o acesso não depender de quem tem o link.
  // A caixa de e-mail continua sendo a prova.
  return destinatario === 'cliente'
    ? `${base}/portal-do-cliente`
    : `${base}/?job=${jobId}`;
};

export interface ResultadoDoEnvio {
  enviado: boolean;
  motivo?: string;
}

/**
 * Monta e manda. `supabase` pode ser o do usuário (com RLS) ou o de serviço:
 * quem chama decide, e a consulta é a mesma.
 */
export const enviarEmailDoSistema = async (
  supabase: SupabaseClient,
  entrada: { evento: string; jobId: string; destino: string }
): Promise<ResultadoDoEnvio> => {
  if (!process.env.RESEND_API_KEY) {
    return { enviado: false, motivo: 'RESEND_API_KEY não configurada no servidor.' };
  }

  const { data: job } = await supabase
    .from('jobs')
    .select('id, title, workspace_id, client_id, last_feedback')
    .eq('id', entrada.jobId)
    .maybeSingle();

  if (!job) return { enviado: false, motivo: 'Conteúdo não encontrado.' };

  const { data: modelo } = await supabase
    .from('email_templates')
    .select('assunto, corpo, ativo, destinatario')
    .eq('evento', entrada.evento)
    .maybeSingle();

  if (!modelo) return { enviado: false, motivo: 'Modelo de e-mail não encontrado.' };

  // Desligado na tela do Super Admin não é erro: é a resposta certa.
  if (!modelo.ativo) return { enviado: false, motivo: 'Disparo desligado nas configurações.' };

  const { data: cliente } = await supabase
    .from('clients')
    .select('name')
    .eq('id', job.client_id)
    .maybeSingle();

  const { data: agencia } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', job.workspace_id)
    .maybeSingle();

  const link = linkDoEmail(modelo.destinatario, job.id);

  const valores: Record<string, string> = {
    cliente: cliente?.name || 'cliente',
    agencia: agencia?.name || 'sua agência',
    titulo: job.title,
    feedback: job.last_feedback || '',
    link,
  };

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: REMETENTE,
    to: entrada.destino,
    subject: preencher(modelo.assunto, valores),
    html: corpoEmHtml(preencher(modelo.corpo, valores), link),
  });

  if (error) {
    return { enviado: false, motivo: error.message || 'Resend recusou o envio.' };
  }

  return { enviado: true };
};

/**
 * Esvazia a fila. Chamado pelo cron que já roda de 5 em 5 minutos.
 *
 * `LOTE` pequeno de propósito: a função tem tempo limitado de execução, e
 * deixar o resto para daqui a cinco minutos é melhor que estourar no meio e
 * não saber o que foi enviado.
 */
const LOTE = 20;
const MAX_TENTATIVAS = 3;

export const esvaziarFilaDeEmail = async (
  supabase: SupabaseClient
): Promise<{ enviados: number; falhas: number }> => {
  const { data: pendentes, error } = await supabase
    .from('email_queue')
    .select('id, evento, job_id, destinatario, tentativas')
    .eq('status', 'pendente')
    .lt('tentativas', MAX_TENTATIVAS)
    .order('created_at')
    .limit(LOTE);

  if (error || !pendentes || pendentes.length === 0) {
    if (error) console.error('[fila-de-email] busca', error.message);
    return { enviados: 0, falhas: 0 };
  }

  let enviados = 0;
  let falhas = 0;

  for (const item of pendentes) {
    const tentativas = (item.tentativas ?? 0) + 1;

    try {
      const res = await enviarEmailDoSistema(supabase, {
        evento: item.evento,
        jobId: item.job_id,
        destino: item.destinatario,
      });

      if (res.enviado) {
        await supabase
          .from('email_queue')
          .update({ status: 'enviado', tentativas, enviado_em: new Date().toISOString() })
          .eq('id', item.id);
        enviados++;
        continue;
      }

      // "Não enviado" com motivo definitivo (modelo desligado, conteúdo
      // apagado) não melhora tentando de novo: fecha na primeira.
      const definitivo =
        res.motivo?.includes('desligado') ||
        res.motivo?.includes('não encontrado') ||
        res.motivo?.includes('não encontrada');

      await supabase
        .from('email_queue')
        .update({
          status: definitivo || tentativas >= MAX_TENTATIVAS ? 'falhou' : 'pendente',
          tentativas,
          erro: res.motivo ?? null,
        })
        .eq('id', item.id);
      falhas++;
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : 'Falha desconhecida.';
      console.error('[fila-de-email]', item.id, motivo);
      await supabase
        .from('email_queue')
        .update({
          status: tentativas >= MAX_TENTATIVAS ? 'falhou' : 'pendente',
          tentativas,
          erro: motivo,
        })
        .eq('id', item.id);
      falhas++;
    }
  }

  return { enviados, falhas };
};
