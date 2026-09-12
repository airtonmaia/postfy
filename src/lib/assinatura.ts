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
 * O rótulo curto do plano — uma linha, para o rodapé da barra lateral.
 *
 * **Só diz o que o banco respondeu.** `acesso` é sempre o retorno de
 * `acesso_da_agencia()`; quando a consulta ainda não voltou, quem chama não
 * desenha nada em vez de chutar "Plano Pro" — é a mesma regra que tirou o
 * `MRR = agências × R$ 197` da tela do Financeiro.
 *
 * A versão longa desta mesma informação (com o que fazer a respeito, e o
 * botão de assinar) mora em `SettingsOverview`. As duas leem o mesmo `motivo`
 * de propósito: é o banco que decide o texto, não cada tela.
 */
export interface RotuloDoPlano {
  titulo: string;
  detalhe: string;
  tom: 'ok' | 'aviso' | 'ruim';
}

export const rotuloDoPlano = (acesso: AcessoDaAgencia): RotuloDoPlano => {
  switch (acesso.motivo) {
    case 'ativa':
      return {
        // `plano` é o nome que veio do Stripe. Sem ele, a frase genérica —
        // inventar "Profissional" aqui seria afirmar o que ninguém mediu.
        titulo: acesso.plano || 'Assinatura ativa',
        detalhe: acesso.cancelarNoFim ? 'Cancelamento agendado' : 'Plano ativo',
        tom: acesso.cancelarNoFim ? 'aviso' : 'ok',
      };
    case 'inadimplente':
      return {
        titulo: acesso.plano || 'Assinatura',
        detalhe: 'Pagamento não confirmado',
        tom: 'aviso',
      };
    case 'vencida':
      return { titulo: 'Assinatura vencida', detalhe: 'Renovação não registrada', tom: 'ruim' };
    case 'cancelada':
      return { titulo: 'Assinatura cancelada', detalhe: 'Assine para voltar', tom: 'ruim' };
    case 'teste_vencido':
      return { titulo: 'Teste encerrado', detalhe: 'Assine para continuar', tom: 'ruim' };
    default:
      return {
        titulo: 'Teste grátis',
        detalhe: diasRestantes(acesso.testeTerminaEm),
        tom: 'aviso',
      };
  }
};

/**
 * Quantos dias faltam, em texto.
 *
 * Contagem em dias, e não data formatada, porque é o que se lê de relance num
 * rodapé — e porque contagem não depende de fuso: a diferença entre dois
 * instantes é a mesma em qualquer lugar do mundo, enquanto "14/10" muda de
 * dia conforme o fuso de quem lê (armadilha 8.2).
 */
const diasRestantes = (quando?: string): string => {
  if (!quando) return 'Sem data de término';
  const fim = new Date(quando).getTime();
  if (Number.isNaN(fim)) return 'Sem data de término';

  const dias = Math.ceil((fim - Date.now()) / 86_400_000);
  if (dias <= 0) return 'Termina hoje';
  if (dias === 1) return 'Termina amanhã';
  return `Termina em ${dias} dias`;
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
