import { rota } from './_lib/rota.js';
import {
  usuarioDaRequisicao,
  clienteDoUsuario,
  clienteDeServico,
  json,
  naoAutenticado,
  falharComSeguranca,
  textoValido,
  excedeuLimite,
} from './_lib/auth.js';
import { clienteStripe, linhaDaAssinatura } from './_lib/stripe.js';

/**
 * Assinatura da agência com o Orquesia. Três coisas numa rota só.
 *
 *   POST + cabeçalho `stripe-signature`  → webhook do Stripe
 *   POST { acao: 'checkout' } + sessão   → abre o pagamento
 *   POST { acao: 'portal' }  + sessão    → abre o portal de cobrança
 *
 * Uma rota e não três porque o plano Hobby da Vercel aceita 12 funções por
 * deploy (armadilha 6). O webhook precisa de URL fixa — é ela que vai
 * cadastrada no painel do Stripe —, então é ele quem define o caminho.
 *
 * ## Por que o webhook não confere a assinatura do jeito padrão
 *
 * `stripe.webhooks.constructEvent` exige o corpo **byte a byte** como o
 * Stripe assinou. Não temos isso: a Vercel entrega handlers `(req, res)` com
 * o corpo já parseado, e `api/_lib/rota.ts` o re-serializa com
 * `JSON.stringify` para o `request.json()` funcionar. Ordem de chaves e
 * espaços mudam, e a conferência falharia em 100% das chamadas — o pior tipo
 * de falha, porque pareceria ataque.
 *
 * A saída é mais forte que a assinatura, não mais fraca: **nada do corpo é
 * gravado.** O corpo só diz "alguma coisa mudou, olhe a assinatura X". Em
 * seguida a rota busca essa assinatura na API do Stripe, autenticada com a
 * nossa chave secreta, e grava o que **eles** responderem. Um corpo forjado
 * não consegue escrever dado falso: ou o id não existe lá e nada acontece,
 * ou existe e o que gravamos é a verdade do Stripe de qualquer forma.
 *
 * Quando o corpo cru sobrevive (runtime que não pré-parseia), a assinatura é
 * conferida também — não custa nada e fecha o caso do id adivinhado.
 */

const EVENTOS_QUE_IMPORTAM = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
  'invoice.paid',
]);

const baseDoApp = (): string => process.env.APP_URL || 'https://app.orquesia.com.br';

// ---------------------------------------------------------------- webhook

async function webhook(request: Request, corpoTexto: string): Promise<Response> {
  const stripe = clienteStripe();
  if (!stripe) {
    // 503 e não 400: o problema é nosso, e o Stripe reenvia depois — o que é
    // exatamente o que queremos enquanto a chave não está configurada.
    return json({ error: 'STRIPE_SECRET_KEY não configurada no servidor.' }, 503);
  }

  const supabase = clienteDeServico();
  if (!supabase) {
    return json({ error: 'SUPABASE_SECRET_KEY não configurada no servidor.' }, 503);
  }

  let evento: any;
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  const assinatura = request.headers.get('stripe-signature');

  if (segredo && assinatura) {
    try {
      evento = stripe.webhooks.constructEvent(corpoTexto, assinatura, segredo);
    } catch {
      // Esperado quando o corpo foi re-serializado. Cai na conferência por
      // consulta, abaixo — que não depende de byte nenhum.
      evento = null;
    }
  }

  if (!evento) {
    let corpo: any;
    try {
      corpo = JSON.parse(corpoTexto);
    } catch {
      return json({ error: 'Corpo inválido.' }, 400);
    }

    if (!textoValido(corpo?.id, 128)) {
      return json({ error: 'Evento sem id.' }, 400);
    }

    try {
      // A prova: o evento é buscado no Stripe com a nossa chave. Se não
      // existe lá, não aconteceu.
      evento = await stripe.events.retrieve(corpo.id);
    } catch {
      return json({ error: 'Evento não encontrado no Stripe.' }, 400);
    }
  }

  if (!EVENTOS_QUE_IMPORTAM.has(evento.type)) {
    // 200 de propósito: o Stripe reenvia o que não recebe 2xx, e um evento
    // que não nos interessa reenviado para sempre é ruído puro.
    return json({ ignorado: evento.type });
  }

  try {
    const { subscriptionId, workspaceId } = await alvoDoEvento(stripe, evento);
    if (!subscriptionId) return json({ ok: true, semAssinatura: true });

    // O dado gravado vem da API, nunca do corpo.
    const assinaturaDoStripe = await stripe.subscriptions.retrieve(subscriptionId);

    // De onde sai a agência: gravamos o id dela em `metadata` no checkout,
    // e o Stripe devolve isso em toda leitura da assinatura. Sem isso não há
    // como saber que linha atualizar — o customer do Stripe não conhece o
    // nosso schema.
    const agencia =
      workspaceId ||
      (assinaturaDoStripe.metadata?.workspace_id as string | undefined) ||
      null;

    if (!agencia) {
      console.error('[assinatura] evento sem workspace_id', evento.type, subscriptionId);
      return json({ ok: true, semAgencia: true });
    }

    const { error } = await supabase
      .from('subscriptions')
      .upsert(
        { workspace_id: agencia, ...linhaDaAssinatura(assinaturaDoStripe) },
        { onConflict: 'workspace_id' }
      );

    if (error) {
      console.error('[assinatura] upsert', error.message);
      // 500 para o Stripe reenviar: perder o evento deixaria a agência
      // pagando sem acesso, que é o pior desfecho possível aqui.
      return json({ error: 'Não foi possível gravar a assinatura.' }, 500);
    }

    return json({ ok: true, evento: evento.type });
  } catch (erro) {
    console.error('[assinatura] webhook', erro instanceof Error ? erro.message : erro);
    return json({ error: 'Falha ao processar o evento.' }, 500);
  }
}

/** Qual assinatura o evento fala, e de qual agência, quando ele já diz. */
async function alvoDoEvento(
  stripe: ReturnType<typeof clienteStripe>,
  evento: any
): Promise<{ subscriptionId: string | null; workspaceId: string | null }> {
  const objeto = evento.data?.object ?? {};

  if (evento.type === 'checkout.session.completed') {
    const sessao = await stripe!.checkout.sessions.retrieve(objeto.id);
    return {
      subscriptionId:
        typeof sessao.subscription === 'string' ? sessao.subscription : sessao.subscription?.id ?? null,
      workspaceId: (sessao.metadata?.workspace_id as string) || null,
    };
  }

  if (evento.type.startsWith('invoice.')) {
    const assinatura = objeto.subscription ?? objeto.parent?.subscription_details?.subscription;
    return {
      subscriptionId: typeof assinatura === 'string' ? assinatura : assinatura?.id ?? null,
      workspaceId: null,
    };
  }

  return { subscriptionId: objeto.id ?? null, workspaceId: null };
}

// ------------------------------------------------------- checkout e portal

async function acaoDoUsuario(request: Request, corpoTexto: string): Promise<Response> {
  const usuario = await usuarioDaRequisicao(request);
  if (!usuario) return naoAutenticado();

  if (excedeuLimite(`assinatura:${usuario.id}`, 10, 60_000)) {
    return json({ error: 'Muitas tentativas seguidas. Aguarde um instante.' }, 429);
  }

  let corpo: any;
  try {
    corpo = JSON.parse(corpoTexto);
  } catch {
    return json({ error: 'Corpo da requisição não é um JSON válido.' }, 400);
  }

  const { acao, workspaceId } = corpo || {};
  if (!textoValido(workspaceId, 64)) {
    return json({ error: 'Agência não informada.' }, 400);
  }

  const stripe = clienteStripe();
  if (!stripe || !process.env.STRIPE_PRICE_ID) {
    return json(
      {
        error:
          'Cobrança não configurada. Defina STRIPE_SECRET_KEY e STRIPE_PRICE_ID no servidor.',
        code: 'STRIPE_NOT_CONFIGURED',
      },
      503
    );
  }

  try {
    // Quem paga é o dono da agência. A consulta passa pela RLS da sessão:
    // se a pessoa não é membro, volta vazia — e é essa a resposta.
    const supabaseDoUsuario = clienteDoUsuario(request);
    const { data: membro, error: erroMembro } = await supabaseDoUsuario
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', usuario.id)
      .maybeSingle();

    if (erroMembro) return falharComSeguranca('assinatura/membro', erroMembro, 500);
    if (!membro || !['owner', 'admin'].includes(membro.role)) {
      return json({ error: 'Só o proprietário ou um administrador da agência assina.' }, 403);
    }

    const supabase = clienteDeServico();
    if (!supabase) {
      return json({ error: 'SUPABASE_SECRET_KEY não configurada no servidor.' }, 503);
    }

    const { data: atual } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (acao === 'portal') {
      if (!atual?.stripe_customer_id) {
        return json({ error: 'Esta agência ainda não tem assinatura.' }, 409);
      }
      const portal = await stripe.billingPortal.sessions.create({
        customer: atual.stripe_customer_id,
        return_url: `${baseDoApp()}/configuracoes`,
      });
      return json({ url: portal.url });
    }

    if (acao !== 'checkout') {
      return json({ error: 'Ação desconhecida.' }, 400);
    }

    const { data: agencia } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .maybeSingle();

    const sessao = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      // Cliente já existente é reaproveitado: criar outro duplicaria a
      // agência no painel do Stripe e quebraria o `unique` da nossa tabela.
      ...(atual?.stripe_customer_id
        ? { customer: atual.stripe_customer_id }
        : { customer_email: usuario.email }),
      // É por aqui que o webhook descobre de qual agência é a assinatura.
      // Nos dois lugares: a sessão expira, a assinatura fica.
      metadata: { workspace_id: workspaceId, agencia: agencia?.name ?? '' },
      subscription_data: { metadata: { workspace_id: workspaceId } },
      success_url: `${baseDoApp()}/configuracoes?assinatura=ok`,
      cancel_url: `${baseDoApp()}/configuracoes?assinatura=cancelado`,
    });

    return json({ url: sessao.url });
  } catch (erro) {
    return falharComSeguranca('assinatura/acao', erro);
  }
}

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  // Lido uma vez: o corpo de um Request só pode ser consumido uma vez, e os
  // dois caminhos abaixo precisam dele.
  let corpoTexto: string;
  try {
    corpoTexto = await request.text();
  } catch {
    return json({ error: 'Não foi possível ler o corpo.' }, 400);
  }

  // O webhook primeiro: ele chega sem sessão do Supabase, e
  // `usuarioDaRequisicao` leria o `Authorization` dele como se fosse um JWT.
  if (request.headers.get('stripe-signature')) {
    return webhook(request, corpoTexto);
  }

  return acaoDoUsuario(request, corpoTexto);
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
