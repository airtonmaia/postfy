import { Resend } from 'resend';
import { rota } from './_lib/rota';
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
 * Envio do convite de equipe por e-mail (Resend).
 *
 * O convite em si já foi criado no banco pela RPC criar_convite, que confere
 * o papel de quem convida. Esta função só entrega o link — e reconfere a
 * permissão, porque uma rota que dispara e-mail em nome do domínio não pode
 * confiar no que o cliente afirma.
 */

const REMETENTE = process.env.RESEND_FROM || 'Orquesia <convites@orquesia.com.br>';

const escapar = (texto: string): string =>
  texto.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c)
  );

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  const usuario = await usuarioDaRequisicao(request);
  if (!usuario) return naoAutenticado();

  if (!process.env.RESEND_API_KEY) {
    return json(
      {
        error: 'Envio de e-mail não configurado. Defina RESEND_API_KEY no ambiente.',
        code: 'EMAIL_NOT_CONFIGURED',
      },
      503
    );
  }

  if (excedeuLimite(`convite:${usuario.id}`, 20, 60 * 60_000)) {
    return json({ error: 'Muitos convites enviados nesta hora. Tente mais tarde.' }, 429);
  }

  let corpo: any;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'Corpo da requisição não é um JSON válido.' }, 400);
  }

  const { email, link, workspaceId, agencyName, inviterName } = corpo || {};

  if (!textoValido(email, 200) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
    return json({ error: 'Informe um e-mail válido.' }, 400);
  }
  if (!textoValido(link, 1000) || !link.startsWith('http')) {
    return json({ error: 'Link do convite inválido.' }, 400);
  }
  if (!textoValido(workspaceId, 64)) {
    return json({ error: 'Agência não informada.' }, 400);
  }

  try {
    // Reconfere o papel: só proprietário e administrador convidam.
    const supabase = clienteDoUsuario(request);
    const { data: membro, error } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', usuario.id)
      .maybeSingle();

    if (error) return falharComSeguranca('convite/membership', error, 500);
    if (!membro || !['owner', 'admin'].includes(membro.role)) {
      return json({ error: 'Seu perfil não pode convidar pessoas.' }, 403);
    }

    const agencia = escapar(String(agencyName || 'a agência'));
    const quem = escapar(String(inviterName || 'a equipe'));
    const url = escapar(String(link));

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: erroEnvio } = await resend.emails.send({
      from: REMETENTE,
      to: email.trim(),
      subject: `Convite para participar de ${agencia} no Orquesia`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a">
          <h1 style="font-size:20px;font-weight:800;margin:0 0 8px">Você foi convidado</h1>
          <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 24px">
            ${quem} convidou você para participar de <strong>${agencia}</strong> no Orquesia,
            o sistema de gestão de conteúdo da agência.
          </p>
          <a href="${url}"
             style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:700">
            Aceitar convite
          </a>
          <p style="font-size:12px;line-height:1.6;color:#94a3b8;margin:24px 0 0">
            O link vale por 7 dias e só funciona para este endereço de e-mail.
            Se você não esperava este convite, pode ignorar esta mensagem.
          </p>
        </div>
      `,
    });

    if (erroEnvio) {
      return falharComSeguranca('convite/envio', erroEnvio, 502);
    }

    return json({ ok: true });
  } catch (erro) {
    return falharComSeguranca('convite/geral', erro);
  }
}

/**
 * Export nomeado, e sem `export default`, de propósito.
 *
 * O builder da Vercel (@vercel/node) decide a assinatura pelo formato do
 * export: só reconhece handler no padrão Web (Request/Response) quando existe
 * um export nomeado de método (POST/GET/fetch). Com `export default` ele
 * assume o handler clássico do Node e entrega (req, res) — aí
 * `request.headers.get(...)` estoura num IncomingMessage e a função morre
 * antes de responder, devolvendo um 500 sem corpo.
 *
 * Era esse o motivo de nenhuma rota /api ter funcionado em produção.
 * Não troque por default sem reler `unwrapDefaults` no builder.
 */

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
