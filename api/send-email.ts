import { Resend } from 'resend';
import {
  usuarioDaRequisicao,
  clienteDoUsuario,
  json,
  naoAutenticado,
  falharComSeguranca,
  textoValido,
  excedeuLimite,
} from './_lib/auth';

export const config = { runtime: 'nodejs' };

/**
 * Disparo de um e-mail automático do sistema.
 *
 * O modelo vem do banco, não do corpo da requisição: quem define o texto é o
 * dono do SaaS pela tela de Super Admin. O navegador só diz qual evento
 * aconteceu e com quais dados — se pudesse mandar assunto e corpo, qualquer
 * sessão autenticada teria um remetente `@orquesia.com.br` à disposição para
 * escrever o que quisesse.
 *
 * O destinatário também não vem do cliente pelo mesmo motivo: é lido do banco
 * a partir do conteúdo em questão, já sujeito à RLS.
 */

const REMETENTE = process.env.RESEND_FROM || 'Orquesia <avisos@orquesia.com.br>';

const EVENTOS = new Set([
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

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  const usuario = await usuarioDaRequisicao(request);
  if (!usuario) return naoAutenticado();

  if (!process.env.RESEND_API_KEY) {
    return json(
      {
        error: 'Envio de e-mail não configurado. Defina RESEND_API_KEY.',
        code: 'EMAIL_NOT_CONFIGURED',
      },
      503
    );
  }

  if (excedeuLimite(`email:${usuario.id}`, 30, 60_000)) {
    return json({ error: 'Muitos e-mails em sequência. Aguarde um instante.' }, 429);
  }

  let corpo: any;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'Corpo da requisição não é um JSON válido.' }, 400);
  }

  const { evento, jobId } = corpo || {};

  if (!textoValido(evento, 64) || !EVENTOS.has(evento)) {
    return json({ error: 'Evento desconhecido.' }, 400);
  }
  if (!textoValido(jobId, 64)) {
    return json({ error: 'Conteúdo não informado.' }, 400);
  }

  try {
    const supabase = clienteDoUsuario(request);

    // A RLS decide o que este usuário enxerga. Se o conteúdo não é da agência
    // dele, a consulta volta vazia — não é preciso checar nada aqui.
    const { data: job, error: erroJob } = await supabase
      .from('jobs')
      .select('id, title, workspace_id, client_id, last_feedback')
      .eq('id', jobId)
      .maybeSingle();

    if (erroJob) return falharComSeguranca('email/job', erroJob, 500);
    if (!job) return json({ error: 'Conteúdo não encontrado.' }, 404);

    const { data: modelo, error: erroModelo } = await supabase
      .from('email_templates')
      .select('assunto, corpo, ativo, destinatario')
      .eq('evento', evento)
      .maybeSingle();

    if (erroModelo) return falharComSeguranca('email/modelo', erroModelo, 500);
    if (!modelo) return json({ error: 'Modelo de e-mail não encontrado.' }, 404);

    // Desligado na tela do Super Admin não é erro: é a resposta certa.
    if (!modelo.ativo) {
      return json({ enviado: false, motivo: 'Disparo desligado nas configurações.' });
    }

    const { data: cliente } = await supabase
      .from('clients')
      .select('name, email, portal_token')
      .eq('id', job.client_id)
      .maybeSingle();

    const { data: agencia } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', job.workspace_id)
      .maybeSingle();

    // Para quem vai: o cliente recebe no e-mail cadastrado; a agência, no
    // e-mail de quem está na sessão. Nenhum dos dois vem do corpo.
    const destino =
      modelo.destinatario === 'cliente' ? cliente?.email || '' : usuario.email;

    if (!destino) {
      return json({ enviado: false, motivo: 'Destinatário sem e-mail cadastrado.' });
    }

    const base = process.env.APP_URL || 'https://app.orquesia.com.br';
    const link =
      modelo.destinatario === 'cliente' && cliente?.portal_token
        ? `${base}/?portal=${cliente.portal_token}`
        : `${base}/?job=${job.id}`;

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
      to: destino,
      subject: preencher(modelo.assunto, valores),
      html: corpoEmHtml(preencher(modelo.corpo, valores), link),
    });

    if (error) return falharComSeguranca('email/envio', error, 502);

    return json({ enviado: true, para: destino });
  } catch (erro) {
    return falharComSeguranca('email/geral', erro);
  }
}

/**
 * Export nomeado, sem default: é assim que o builder da Vercel reconhece a
 * assinatura Web. Ver o comentário longo em api/upload-url.ts.
 */
export const POST = handler;
