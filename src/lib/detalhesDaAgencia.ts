import { supabase } from './supabase';

/**
 * A ficha completa de uma agência, para a área `/admin`.
 *
 * **Tudo aqui é medido.** O que o banco não sabe não aparece como campo vazio:
 * aparece como frase, na tela, dizendo que não é medido. É a regra do
 * `post_metrics` aplicada ao painel do produto — nulo é "não medi", e "não
 * medi" se diz.
 *
 * Três coisas que a ficha **não** responde, e por quê:
 *
 * - **cidade e país do IP.** Traduzir IP em lugar exige mandar o IP de uma
 *   pessoa para um serviço de terceiro. Isso é dado pessoal saindo do
 *   produto, e é decisão de quem é dono dele — não efeito colateral de abrir
 *   uma ficha. O IP cru está aqui; a tradução não.
 * - **tempo de sessão.** Ninguém grava entrada e saída. `last_sign_in_at` é um
 *   instante, e subtrair instantes para fabricar uma duração seria inventar um
 *   número que vai para uma decisão.
 * - **navegação.** Que tela a pessoa abriu não é registrado em lugar nenhum.
 *   O que existe é `activity_logs`, que guarda **ações** — e é isso que a
 *   ficha mostra, com esse nome.
 */

export interface PessoaDaAgencia {
  userId: string;
  nome?: string;
  email?: string;
  papel: string;
  ativo?: boolean;
  entrouEm?: string;
  contaCriada?: string;
  ultimoAcesso?: string;
}

export interface AcessoRegistrado {
  quando: string;
  acao?: string;
  /** O IP cru, como o Supabase registrou. A cidade não é medida. */
  ip?: string;
  email?: string;
}

export interface AcaoRegistrada {
  quando: string;
  acao: string;
  alvo?: string;
  por: string;
}

export interface DetalhesDaAgencia {
  agencia: {
    id: string;
    nome: string;
    slug: string;
    criadaEm?: string;
    timezone?: string;
    dominio?: string;
    whiteLabel: boolean;
    isTrial: boolean;
    trialEndsAt?: string;
    corPrimaria?: string;
    excluidaEm?: string;
    excluidaPor?: string;
  };
  criador?: PessoaDaAgencia;
  equipe: PessoaDaAgencia[];
  base: {
    clientes: number;
    jobs: number;
    leads: number;
    propostas: number;
    contratos: number;
    materiais: number;
    conexoes: number;
  };
  atividade: {
    total: number;
    primeira?: string;
    ultima?: string;
    recentes: AcaoRegistrada[];
  };
  assinatura?: {
    status: string;
    plano?: string;
    precoCentavos?: number;
    moeda?: string;
    periodoFim?: string;
    cancelarNoFim?: boolean;
    criadoEm?: string;
  };
  acessos: AcessoRegistrado[];
  /**
   * A tabela de auditoria do Supabase respondeu?
   *
   * Ela é interna, pode não estar legível e **é podada** — acesso antigo
   * demais não está mais lá. Sem esta bandeira, uma lista vazia diria, com
   * cara de certo, que ninguém nunca entrou.
   */
  acessosDisponiveis: boolean;
}

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const pessoa = (p: any): PessoaDaAgencia => ({
  userId: String(p?.user_id ?? ''),
  nome: p?.nome ?? undefined,
  email: p?.email ?? undefined,
  papel: String(p?.papel ?? p?.papel_hoje ?? ''),
  ativo: p?.ativo ?? undefined,
  entrouEm: p?.entrou_em ?? undefined,
  contaCriada: p?.conta_criada ?? undefined,
  ultimoAcesso: p?.ultimo_acesso ?? undefined,
});

export const carregarDetalhesDaAgencia = async (
  workspaceId: string
): Promise<DetalhesDaAgencia | null> => {
  const { data, error } = await supabase.rpc('admin_detalhes_da_agencia', {
    p_workspace: workspaceId,
  });
  if (error) throw new Error(error.message);
  if (!data) return null;

  const d = data as any;

  return {
    agencia: {
      id: String(d.agencia?.id ?? workspaceId),
      nome: String(d.agencia?.nome ?? ''),
      slug: String(d.agencia?.slug ?? ''),
      criadaEm: d.agencia?.criada_em ?? undefined,
      timezone: d.agencia?.timezone ?? undefined,
      dominio: d.agencia?.dominio ?? undefined,
      whiteLabel: Boolean(d.agencia?.white_label),
      isTrial: Boolean(d.agencia?.is_trial),
      trialEndsAt: d.agencia?.trial_ends_at ?? undefined,
      corPrimaria: d.agencia?.cor_primaria ?? undefined,
      excluidaEm: d.agencia?.excluida_em ?? undefined,
      excluidaPor: d.agencia?.excluida_por ?? undefined,
    },
    criador: d.criador ? pessoa(d.criador) : undefined,
    equipe: Array.isArray(d.equipe) ? d.equipe.map(pessoa) : [],
    base: {
      clientes: n(d.base?.clientes),
      jobs: n(d.base?.jobs),
      leads: n(d.base?.leads),
      propostas: n(d.base?.propostas),
      contratos: n(d.base?.contratos),
      materiais: n(d.base?.materiais),
      conexoes: n(d.base?.conexoes),
    },
    atividade: {
      total: n(d.atividade?.total),
      primeira: d.atividade?.primeira ?? undefined,
      ultima: d.atividade?.ultima ?? undefined,
      recentes: Array.isArray(d.atividade?.recentes)
        ? d.atividade.recentes.map((a: any) => ({
            quando: String(a?.quando ?? ''),
            acao: String(a?.acao ?? ''),
            alvo: a?.alvo ?? undefined,
            por: String(a?.por ?? ''),
          }))
        : [],
    },
    assinatura: d.assinatura
      ? {
          status: String(d.assinatura.status ?? ''),
          plano: d.assinatura.plano ?? undefined,
          precoCentavos: d.assinatura.preco_centavos ?? undefined,
          moeda: d.assinatura.moeda ?? undefined,
          periodoFim: d.assinatura.periodo_fim ?? undefined,
          cancelarNoFim: d.assinatura.cancelar_no_fim ?? undefined,
          criadoEm: d.assinatura.criado_em ?? undefined,
        }
      : undefined,
    acessos: Array.isArray(d.acessos)
      ? d.acessos.map((a: any) => ({
          quando: String(a?.quando ?? ''),
          acao: a?.acao ?? undefined,
          ip: a?.ip ?? undefined,
          email: a?.email ?? undefined,
        }))
      : [],
    acessosDisponiveis: Boolean(d.acessos_disponiveis),
  };
};
