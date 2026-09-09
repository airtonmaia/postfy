import { supabase } from './supabase';
import { clientDaLinha, jobDaLinha, clientMaterialDaLinha, workspaceDaLinha } from './mappers';
import type { Client, Job, ClientMaterial, Workspace } from '../types';

/**
 * Dados do Portal do Cliente, para quem não tem sessão de agência.
 *
 * O restante do app lê as tabelas direto, e a RLS recorta por agência a
 * partir do `auth.uid()`. No portal não existe `auth.uid()`: quem está ali é
 * o cliente da agência, que nunca teve conta no sistema. Então tudo passa por
 * RPCs `security definer` que recebem o token do portal e recortam por ele.
 *
 * O token vale como credencial — é ele que o código enviado por e-mail
 * destrava. Fora daqui, nenhuma tabela é alcançável por sessão anônima.
 */

/**
 * Onde o token fica entre um F5 e outro.
 *
 * `sessionStorage`, não `localStorage`: o portal roda na máquina do cliente,
 * que pode ser compartilhada, e a credencial deve morrer junto com a aba.
 * Sem guardar em lugar nenhum, recarregar a página jogava a pessoa de volta
 * para a tela do código a cada vez.
 *
 * Isolado neste módulo para o teste de guarda em `tests/ids.test.ts`
 * continuar valendo sobre o contexto, onde mora o estado da agência.
 */
const CHAVE_TOKEN = 'orquesia:portal';

export const tokenGuardado = (): string | null => {
  try {
    return window.sessionStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
};

export const guardarToken = (token: string): void => {
  try {
    window.sessionStorage.setItem(CHAVE_TOKEN, token);
  } catch {
    /* Sem sessionStorage a sessão dura até o F5, e só. */
  }
};

export const esquecerToken = (): void => {
  try {
    window.sessionStorage.removeItem(CHAVE_TOKEN);
  } catch {
    /* idem */
  }
};

/**
 * Marca da agência na porta do portal, antes de haver sessão.
 *
 * O portal é whitelabel: quem chega foi convidado pela agência, não pelo
 * Orquesia. Sem isto a tela abre com a nossa marca, e o cliente conclui que
 * errou o endereço.
 *
 * Devolve `null` quando o slug não existe ou a rede falha — a tela cai na
 * marca padrão em vez de não abrir. Ninguém deixa de aprovar conteúdo porque
 * o logo não carregou.
 */
export const carregarMarcaDaAgencia = async (
  slug: string
): Promise<Pick<Workspace, 'name' | 'slug' | 'logo' | 'favicon' | 'primaryColor' | 'secondaryColor'> | null> => {
  try {
    const { data, error } = await supabase.rpc('marca_da_agencia', { p_slug: slug });
    if (error || !data) return null;

    const b = data as any;
    return {
      name: b.name,
      slug: b.slug,
      logo: b.logo ?? '',
      favicon: b.favicon ?? null,
      primaryColor: b.primary_color ?? '#6366f1',
      secondaryColor: b.secondary_color ?? null,
    };
  } catch {
    return null;
  }
};

export interface DadosDoPortal {
  cliente: Client;
  workspace: Workspace;
  jobs: Job[];
  materiais: ClientMaterial[];
}

export const carregarPortal = async (token: string): Promise<DadosDoPortal | null> => {
  const { data, error } = await supabase.rpc('portal_dados', { p_token: token });
  if (error) throw new Error(error.message);
  if (!data) return null;

  const bruto = data as any;

  return {
    cliente: clientDaLinha(bruto.cliente),
    workspace: workspaceDaLinha(bruto.workspace),
    jobs: (bruto.jobs || []).map(jobDaLinha),
    materiais: (bruto.materiais || []).map(clientMaterialDaLinha),
  };
};

/**
 * Aprovar e pedir ajuste passam por RPC pelo mesmo motivo da leitura: um
 * `update` direto na tabela `jobs` seria recusado pela RLS, e a tela mostraria
 * a aprovação que o banco nunca gravou.
 */
export const aprovarPeloPortal = async (
  token: string,
  jobId: string,
  quem: string
): Promise<boolean> => {
  const { data, error } = await supabase.rpc('portal_aprovar', {
    p_token: token,
    p_job_id: jobId,
    p_quem: quem,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
};

export const pedirAjustePeloPortal = async (
  token: string,
  jobId: string,
  feedback: string,
  quem: string
): Promise<boolean> => {
  const { data, error } = await supabase.rpc('portal_pedir_ajuste', {
    p_token: token,
    p_job_id: jobId,
    p_feedback: feedback,
    p_quem: quem,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
};
