import { supabase } from './supabase';
import { chamar } from './api';

/**
 * A assinatura da agência com o Orquesia.
 *
 * Não confundir com `plans`: aquele é o catálogo que cada agência monta para
 * os clientes dela. Este é o que a agência paga para usar o produto.
 *
 * Quem escreve é o webhook do Stripe, com a chave de serviço — `subscriptions`
 * não tem política de escrita para sessão autenticada, de propósito. Daqui só
 * se lê, e só se pede o link do checkout.
 */

export type StatusDaAssinatura = 'teste' | 'ativa' | 'inadimplente' | 'cancelada';

export interface AcessoDaAgencia {
  /** Pode usar o produto agora. */
  liberado: boolean;
  /** Por quê: `teste`, `teste_vencido`, `ativa`, `vencida`, `inadimplente`, `cancelada`. */
  motivo: string;
  status: StatusDaAssinatura;
  plano?: string;
  precoCentavos?: number;
  moeda: string;
  periodoFim?: string;
  cancelarNoFim: boolean;
  testeTerminaEm?: string;
  temAssinatura: boolean;
}

export const carregarAcessoDaAgencia = async (
  workspaceId: string
): Promise<AcessoDaAgencia> => {
  const { data, error } = await supabase.rpc('acesso_da_agencia', {
    p_workspace_id: workspaceId,
  });
  if (error) throw new Error(error.message);

  const b = (data || {}) as any;
  return {
    liberado: Boolean(b.liberado),
    motivo: String(b.motivo || 'teste'),
    status: (b.status || 'teste') as StatusDaAssinatura,
    plano: b.plano ?? undefined,
    precoCentavos: b.preco_centavos ?? undefined,
    moeda: b.moeda || 'brl',
    periodoFim: b.periodo_fim ?? undefined,
    cancelarNoFim: Boolean(b.cancelar_no_fim),
    testeTerminaEm: b.teste_termina_em ?? undefined,
    temAssinatura: Boolean(b.tem_assinatura),
  };
};

/**
 * Abre o checkout ou o portal de cobrança do Stripe.
 *
 * Devolve uma URL para onde mandar a pessoa. O link é gerado no servidor
 * porque criar a sessão exige a chave secreta do Stripe — que não pode
 * chegar ao navegador.
 */
export const abrirCobranca = async (
  acao: 'checkout' | 'portal',
  workspaceId: string
): Promise<string> => {
  const { url } = await chamar<{ url: string }>('/api/assinatura', { acao, workspaceId });
  return url;
};
