import { Resend } from 'resend';
import { rota } from './_lib/rota.js';
import {
  clienteDeServico,
  json,
  falharComSeguranca,
  textoValido,
  excedeuLimite,
} from './_lib/auth.js';

/**
 * Entrada do Portal do Cliente: e-mail + código de 6 dígitos.
 *
 * O telefone identificava, não autenticava — quem soubesse o número entrava.
 * Agora o acesso exige provar que a caixa de e-mail é sua.
 *
 * A rota é anônima por natureza (quem chama ainda não tem sessão), então ela
 * é o único lugar onde as duas funções sensíveis do banco podem ser
 * chamadas: `portal_emitir_codigo` devolve o código em claro, e
 * `portal_conferir_codigo` sem limite de taxa na frente seria força bruta em
 * seis dígitos. Ambas têm EXECUTE só para `service_role`.
 *
 * **A resposta de `enviar` é sempre a mesma**, exista o e-mail ou não: a
 * diferença transformaria a rota num verificador de "este e-mail é cliente de
 * alguma agência aqui?".
 */

const REMETENTE = process.env.RESEND_FROM || 'Orquesia <avisos@orquesia.com.br>';

/** Seis dígitos com fonte criptográfica — `Math.random` é previsível. */
const gerarCodigo = (): string => {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1000000).padStart(6, '0');
};

const escapar = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const corpoDoEmail = (codigo: string, agencia: string): string => `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a;line-height:1.6;font-size:14px">
    <p style="margin:0 0 12px">Olá!</p>
    <p style="margin:0 0 12px">
      Use o código abaixo para entrar no portal de ${escapar(agencia)}.
    </p>
    <div style="text-align:center;margin:28px 0">
      <span style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;
                   padding:16px 32px;font-size:32px;font-weight:700;letter-spacing:8px;font-family:monospace">
        ${escapar(codigo)}
      </span>
    </div>
    <p style="margin:0 0 12px;color:#64748b">
      O código vale por 10 minutos. Se não foi você que pediu, ignore este e-mail —
      ninguém entra sem ele.
    </p>
  </div>
`;

const normalizarEmail = (valor: unknown): string =>
  typeof valor === 'string' ? valor.trim().toLowerCase() : '';

/**
 * Separa "a credencial do servidor não vale" de "deu errado".
 *
 * Custou duas rodadas de diagnóstico: a SUPABASE_SECRET_KEY da Vercel estava
 * preenchida com um valor que o Supabase recusava. Toda chamada voltava 401,
 * o `falharComSeguranca` engolia o motivo — como deve mesmo fazer com erro de
 * banco — e o cliente lia "Tente novamente em instantes". A informação que
 * resolvia estava só no log do Supabase.
 *
 * Não é vazamento: 401 aqui é o servidor falando do **próprio** crachá com o
 * banco, não do que o visitante mandou. Quem está do outro lado não muda nada
 * sabendo disso — e quem opera o sistema economiza a caçada.
 */
const credencialOuFalha = (onde: string, erro: unknown): Response => {
  const status = (erro as { status?: number } | null)?.status;
  const codigo = (erro as { code?: string } | null)?.code;

  if (status === 401 || codigo === 'PGRST301' || codigo === '42501') {
    return json(
      {
        error:
          'Portal indisponível: a credencial do servidor foi recusada pelo banco. ' +
          'Confira SUPABASE_SECRET_KEY e refaça o deploy — o ambiente é congelado no deploy.',
        code: 'SERVICE_KEY_INVALID',
      },
      503
    );
  }

  return falharComSeguranca(onde, erro, 500);
};

async function handler(request: Request): Promise<Response> {
  let corpo: any;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'Corpo inválido.' }, 400);
  }

  const { acao, email, codigo } = corpo || {};
  const alvo = normalizarEmail(email);

  if (!alvo || !alvo.includes('@') || alvo.length > 320) {
    return json({ error: 'Informe um e-mail válido.' }, 400);
  }

  const supabase = clienteDeServico();
  if (!supabase) {
    // A convenção do projeto: dizer o que falta, com o nome da variável.
    return json(
      { error: 'Portal indisponível: falta configurar SUPABASE_SECRET_KEY no servidor.' },
      503
    );
  }

  if (acao === 'enviar') {
    if (excedeuLimite(`portal-codigo:${alvo}`, 5, 15 * 60 * 1000)) {
      return json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, 429);
    }

    // O limite acima é por container; este é global, porque o que ele protege
    // (a caixa de e-mail de outra pessoa virar alvo de spam) não some só
    // porque a requisição caiu noutra instância.
    const desde = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('portal_codigos')
      .select('id', { count: 'exact', head: true })
      .eq('email', alvo)
      .gte('created_at', desde);

    if ((count ?? 0) >= 5) {
      return json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, 429);
    }

    const codigoNovo = gerarCodigo();
    const { data, error } = await supabase.rpc('portal_emitir_codigo', {
      p_email: alvo,
      p_codigo: codigoNovo,
    });

    if (error) return credencialOuFalha('portal/emitir', error);

    // Sem cliente para este e-mail: a resposta é a mesma do caso feliz.
    if (!data) return json({ enviado: true });

    if (!process.env.RESEND_API_KEY) {
      return json(
        { error: 'Portal indisponível: falta configurar RESEND_API_KEY no servidor.' },
        503
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: erroEnvio } = await resend.emails.send({
      from: REMETENTE,
      to: alvo,
      subject: `${codigoNovo} é o seu código de acesso`,
      html: corpoDoEmail(codigoNovo, (data as any)?.nome_agencia || 'sua agência'),
    });

    if (erroEnvio) return falharComSeguranca('portal/email', erroEnvio, 502);

    return json({ enviado: true });
  }

  if (acao === 'conferir') {
    if (!textoValido(codigo, 12)) {
      return json({ error: 'Informe o código recebido por e-mail.' }, 400);
    }

    // Mais apertado que o envio: é aqui que a força bruta bateria. O banco
    // ainda invalida o código após cinco erros; este limite existe para o
    // atacante não poder pedir um código novo a cada cinco tentativas.
    if (excedeuLimite(`portal-conferir:${alvo}`, 10, 15 * 60 * 1000)) {
      return json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, 429);
    }

    const { data, error } = await supabase.rpc('portal_conferir_codigo', {
      p_email: alvo,
      p_codigo: String(codigo).trim(),
    });

    if (error) return credencialOuFalha('portal/conferir', error);
    if (!data) return json({ error: 'Código inválido ou expirado.' }, 401);

    return json({ token: data });
  }

  return json({ error: 'Ação desconhecida.' }, 400);
}

export const POST = handler;
export default rota(handler);
