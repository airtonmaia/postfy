import Stripe from 'stripe';

/**
 * Cliente do Stripe e a tradução do vocabulário dele para o nosso.
 *
 * Fica isolado aqui pelo mesmo motivo de `api/_lib/instagram.ts`: a rota
 * cuida de quem pode chamar, e o fornecedor fica num arquivo que dá para
 * trocar sem mexer em autorização.
 */

/** `null` quando a chave não está configurada — a tela diz o que falta. */
export const clienteStripe = (): Stripe | null => {
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) return null;
  return new Stripe(chave, {
    // Fixa de propósito: a versão da API muda o formato do que o webhook
    // recebe, e "atualizou sozinho" é o tipo de mudança que só aparece
    // quando uma cobrança não é registrada.
    apiVersion: '2026-08-26.dahlia',
  });
};

export const stripeConfigurado = (): boolean =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);

/**
 * O status do Stripe vira um dos quatro que a tela entende.
 *
 * O vocabulário deles é mais fino do que o produto precisa — `incomplete`,
 * `incomplete_expired`, `paused`, `unpaid`. Traduzir na borda evita que cada
 * tela invente a própria interpretação de `past_due`.
 */
export const traduzirStatus = (status: string): 'ativa' | 'inadimplente' | 'cancelada' | 'teste' => {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'ativa';
    case 'past_due':
    case 'unpaid':
      return 'inadimplente';
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelada';
    // `incomplete` é a assinatura criada e ainda não paga: o checkout foi
    // aberto e abandonado. Não é ativa nem cancelada — é como se não
    // existisse, e o teste da agência é quem manda.
    case 'incomplete':
    case 'paused':
    default:
      return 'teste';
  }
};

/** Linha de `subscriptions` a partir do objeto do Stripe. */
export const linhaDaAssinatura = (
  assinatura: Stripe.Subscription
): Record<string, unknown> => {
  const item = assinatura.items?.data?.[0];
  const preco = item?.price;

  // `current_period_end` vive no item desde a API 2025-03; o topo da
  // assinatura deixou de trazê-lo. Ler dos dois lugares evita gravar `null`
  // e o app achar que a assinatura venceu.
  const fim =
    (item as { current_period_end?: number } | undefined)?.current_period_end ??
    (assinatura as unknown as { current_period_end?: number }).current_period_end;

  return {
    stripe_subscription_id: assinatura.id,
    stripe_customer_id:
      typeof assinatura.customer === 'string' ? assinatura.customer : assinatura.customer?.id,
    status: traduzirStatus(assinatura.status),
    plano: preco?.nickname || (typeof preco?.product === 'string' ? preco.product : null),
    preco_centavos: preco?.unit_amount ?? null,
    moeda: preco?.currency || 'brl',
    periodo_fim: fim ? new Date(fim * 1000).toISOString() : null,
    cancelar_no_fim: Boolean(assinatura.cancel_at_period_end),
    atualizado_em: new Date().toISOString(),
  };
};
