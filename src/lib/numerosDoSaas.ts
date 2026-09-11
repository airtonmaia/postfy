import { supabase } from './supabase';

/**
 * Os números do produto inteiro.
 *
 * Vêm de uma RPC `security definer` porque do navegador não dá: a RLS recorta
 * clientes, jobs e fila por agência, e quem administra o produto não é membro
 * das agências dos clientes. Contar daqui daria zero.
 *
 * A função devolve só contagem — nenhum título, nome ou e-mail. O dono do
 * SaaS sabe o tamanho da base sem ler o conteúdo das agências.
 */

export interface NumerosDoSaas {
  agencias: { total: number; emTeste: number; foraDoTeste: number; comDominio: number };
  usuarios: {
    total: number;
    confirmados: number;
    ativos30d: number;
    semAgencia: number;
    vinculos: number;
    convitesPendentes: number;
  };
  conteudo: { clientes: number; jobs: number; jobs30d: number; leads: number; contratos: number };
  jobsPorStatus: Record<string, number>;
  filaDePublicacao: Record<string, number>;
  porMes: { mes: string; agencias: number; usuarios: number; jobs: number }[];
  apuradoEm: string;
}

const n = (v: unknown): number => Number(v ?? 0);

export const carregarNumerosDoSaas = async (): Promise<NumerosDoSaas> => {
  const { data, error } = await supabase.rpc('admin_numeros_do_saas');
  if (error) throw new Error(error.message);

  const b = (data || {}) as any;
  return {
    agencias: {
      total: n(b.agencias?.total),
      emTeste: n(b.agencias?.em_teste),
      foraDoTeste: n(b.agencias?.fora_do_teste),
      comDominio: n(b.agencias?.com_dominio),
    },
    usuarios: {
      total: n(b.usuarios?.total),
      confirmados: n(b.usuarios?.confirmados),
      ativos30d: n(b.usuarios?.ativos_30d),
      semAgencia: n(b.usuarios?.sem_agencia),
      vinculos: n(b.usuarios?.vinculos),
      convitesPendentes: n(b.usuarios?.convites_pendentes),
    },
    conteudo: {
      clientes: n(b.conteudo?.clientes),
      jobs: n(b.conteudo?.jobs),
      jobs30d: n(b.conteudo?.jobs_30d),
      leads: n(b.conteudo?.leads),
      contratos: n(b.conteudo?.contratos),
    },
    jobsPorStatus: (b.jobs_por_status || {}) as Record<string, number>,
    filaDePublicacao: (b.fila_de_publicacao || {}) as Record<string, number>,
    porMes: ((b.por_mes || []) as any[]).map((m) => ({
      mes: String(m.mes),
      agencias: n(m.agencias),
      usuarios: n(m.usuarios),
      jobs: n(m.jobs),
    })),
    apuradoEm: String(b.apurado_em || ''),
  };
};

/**
 * Contagens de cada agência, para a lista do Admin.
 *
 * Mesma razão da função acima: do navegador, a RLS de `workspace_members`,
 * `clients` e `jobs` recorta por agência, e quem administra o produto não é
 * membro das agências dos clientes — contar daqui daria zero. A RPC devolve
 * só número, indexado pelo id da agência.
 */
export interface ContagensDaAgencia {
  membros: number;
  clientes: number;
  jobs: number;
}

export const carregarContagensPorAgencia = async (): Promise<
  Record<string, ContagensDaAgencia>
> => {
  const { data, error } = await supabase.rpc('admin_contagens_por_agencia');
  if (error) throw new Error(error.message);

  const bruto = (data || {}) as Record<string, any>;
  const saida: Record<string, ContagensDaAgencia> = {};
  for (const [id, valores] of Object.entries(bruto)) {
    saida[id] = {
      membros: n(valores?.membros),
      clientes: n(valores?.clientes),
      jobs: n(valores?.jobs),
    };
  }
  return saida;
};

/**
 * O que de fato entra: assinaturas ativas, inadimplentes e canceladas.
 *
 * Estes números **são medidos**, ao contrário dos que a tela mostrava antes
 * (`agências × R$ 197`). Zero aqui é um zero apurado — nenhuma assinatura
 * ativa —, e não a ausência do dado. A diferença importa: um é resposta, o
 * outro era chute.
 */
export interface NumerosDeCobranca {
  mrrCentavos: number;
  assinaturas: {
    ativas: number;
    inadimplentes: number;
    canceladas: number;
    cancelamNoFim: number;
  };
  agencias: { total: number; semAssinatura: number; testeVencido: number };
  apuradoEm: string;
}

export const carregarNumerosDeCobranca = async (): Promise<NumerosDeCobranca> => {
  const { data, error } = await supabase.rpc('admin_numeros_de_cobranca');
  if (error) throw new Error(error.message);

  const b = (data || {}) as any;
  return {
    mrrCentavos: n(b.mrr_centavos),
    assinaturas: {
      ativas: n(b.assinaturas?.ativas),
      inadimplentes: n(b.assinaturas?.inadimplentes),
      canceladas: n(b.assinaturas?.canceladas),
      cancelamNoFim: n(b.assinaturas?.cancelam_no_fim),
    },
    agencias: {
      total: n(b.agencias?.total),
      semAssinatura: n(b.agencias?.sem_assinatura),
      testeVencido: n(b.agencias?.teste_vencido),
    },
    apuradoEm: String(b.apurado_em || ''),
  };
};
